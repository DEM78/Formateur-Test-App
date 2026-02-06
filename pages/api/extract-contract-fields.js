// pages/api/extract-contract-fields.js
import { extractText } from "unpdf";
import { createWorker } from "tesseract.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { documents, nom, prenom } = req.body;
    const workerUrl =
      process.env.DOCUMENT_EXTRACTOR_URL ||
      "https://document-extractor.demoorhugo.workers.dev";

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: "documents[] requis" });
    }

    if (!nom || !prenom) {
      return res.status(400).json({ error: "nom et prenom requis" });
    }

    // Extraire texte de tous les documents
    let allText = "";
    let ocrWorker = null;
    let workerExtracted = {};

    const getOcrWorker = async () => {
      if (ocrWorker) return ocrWorker;
      ocrWorker = await createWorker();
      await ocrWorker.loadLanguage("fra+eng");
      await ocrWorker.initialize("fra+eng");
      return ocrWorker;
    };

    for (const doc of documents) {
      if (!doc.fileBase64 || !doc.type) continue;

      try {
        const buffer = Buffer.from(doc.fileBase64, "base64");
        const isPdf = isPdfBuffer(buffer);

        let text = "";
        let workerData = null;

        // Call document-extractor first to reduce OCR work when possible
        if (workerUrl) {
          try {
            const workerRes = await fetch(workerUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileBase64: doc.fileBase64,
                docType: doc.type,
              }),
            });
            const workerJson = await workerRes.json().catch(() => ({}));
            if (workerJson?.success && workerJson?.extracted) {
              workerData = workerJson.extracted;
              workerExtracted = mergePreferNonEmpty(workerExtracted, workerData);
            }
          } catch (e) {
            console.warn("Worker extraction failed:", e.message);
          }
        }

        if (isPdf) {
          text = await extractTextFromPdf(buffer);

          // OCR fallback for scanned PDFs (only if worker didn't already extract key fields)
          const hasKey =
            workerData && (workerData.siret || workerData.siren || workerData.denomination || workerData.adresse);
          if ((!text || text.trim().length < 80) && !hasKey) {
            const ocrText = await ocrPdfViaApi(req, doc.fileBase64, 1);
            if (ocrText && ocrText.length > text.length) text = ocrText;
          }
        } else {
          const worker = await getOcrWorker();
          text = await ocrImage(buffer, worker);
        }

        allText += `\n--- ${doc.type} ---\n${text}\n`;
      } catch (e) {
        console.warn(`Impossible d'extraire ${doc.type}:`, e.message);
      }
    }

    if (ocrWorker) {
      try {
        await ocrWorker.terminate();
      } catch {
        // ignore
      }
    }

    // Extraction via regex + patterns
    const extracted = extractPrestataireFields(allText, nom, prenom);
    const merged = mergePreferNonEmpty(extracted, workerExtracted);

    return res.status(200).json({
      prestataire: merged,
    });
  } catch (error) {
    console.error("Erreur extraction contrat:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
}

function extractPrestataireFields(text, nom, prenom) {
  const prestataire = {
    nom: nom || "",
    prenom: prenom || "",
    denomination: "",
    siren: "",
    siret: "",
    rcs: "",
    adresse: "",
    code_postal: "",
    ville: "",
    representant: `${prenom} ${nom}`,
    fonction_representant: "",
  };

  // SIREN (9 chiffres)
  const siren =
    extractNumberAfterLabels(text, ["SIREN", "S I R E N", "SIREN/", "NUMERO DE SIREN", "NUM\u00C9RO DE SIREN"], 9) ||
    extractNumberNearLabel(text, ["SIREN", "NUMERO DE SIREN", "NUM\u00C9RO DE SIREN"], 9) ||
    extractSirenFromGroupedText(text) ||
    extractFirstNumber(text, 9);
  if (siren) prestataire.siren = siren;

  // SIRET (14 chiffres) - handle spaced groups like 123 456 789 00012
  const siret =
    extractNumberAfterLabels(text, ["SIRET", "S I R E T", "SIRET/", "NUMERO DE SIRET", "NUM\u00C9RO DE SIRET", "N° SIRET", "N SIRET"], 14) ||
    extractNumberAfterLooseLabel(text, ["SIRET", "NUMERO DE SIRET", "NUM\u00C9RO DE SIRET", "N° SIRET", "N SIRET"], 14) ||
    extractNumberNearLabel(text, ["SIRET", "NUMERO DE SIRET", "NUM\u00C9RO DE SIRET"], 14) ||
    extractSiretFromGroupedText(text) ||
    extractFirstNumber(text, 14);
  if (siret) prestataire.siret = siret;

  // RCS
  const rcsMatch =
    text.match(/RCS\s+([A-Z\s-]+)\s*(\d{9})?/i) ||
    text.match(/REGISTRE\s+DU\s+COMMERCE\s+ET\s+DES\s+SOCIETES\s+([A-Z\s-]+)/i);
  if (rcsMatch) prestataire.rcs = rcsMatch[1].trim();

  // Denomination sociale
  const denomMatch =
    text.match(/D(?:\u00C9|E)NOMINATION\s*(SOCIALE)?[:\s]+([^\n]{5,120})/i) ||
    text.match(/RAISON\s+SOCIALE[:\s]+([^\n]{5,120})/i) ||
    text.match(/NOM\s+COMMERCIAL[:\s]+([^\n]{5,120})/i) ||
    text.match(/([A-Z0-9&\s'.-]{8,80})\s+SIREN/i);
  if (denomMatch) {
    prestataire.denomination = (denomMatch[2] || denomMatch[1] || "")
      .replace(/SIREN.*$/i, "")
      .trim();
  }

  // Adresse (pattern francais)
  const adresseMatch =
    text.match(/(\d+\s+[^\n]{6,80}\s+\d{5}\s+[A-Z][A-Za-z\s-]+)/i) ||
    text.match(/ADRESSE\s+[:\-]?\s*([^\n]{10,120})/i);
    text.match(/(\d+\s+[^\n]{6,80}\s+\d{5}\s+[A-Z?-??-?][A-Za-z?-??-??-?\s-]+)/i) ||
    text.match(/ADRESSE\s+[:\-]?\s*([^\n]{10,120})/i);
  if (adresseMatch) {
    const fullAddr = adresseMatch[1];
    prestataire.adresse = fullAddr;

    // Extraire code postal et ville
    const cpVilleMatch = fullAddr.match(/(\d{5})[\s,]+([A-Z][a-zéèêà\s-]+)/i);
    if (cpVilleMatch) {
      prestataire.code_postal = cpVilleMatch[1];
      prestataire.ville = cpVilleMatch[2].trim();
    }
  }

  // Fonction representant
  const fonctionMatch = text.match(/(Gerant|President|Directeur)/i);
  if (fonctionMatch) {
    prestataire.fonction_representant = fonctionMatch[1];
  }

  return prestataire;
}

function isPdfBuffer(buffer) {
  return buffer?.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}

async function extractTextFromPdf(buffer) {
  const uint8 = new Uint8Array(buffer);
  try {
    const extracted = await extractText(uint8, { mergePages: true });
    return (extracted?.text || "").trim();
  } catch {
    return "";
  }
}

async function ocrImage(imageBuffer, worker) {
  const { data } = await worker.recognize(imageBuffer);
  return (data?.text || "").trim();
}

function extractNumberAfterLabels(text, labels, digits) {
  const upper = String(text || "").toUpperCase();
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:\\-\\s]*([0-9\\s]{${digits},})`, "i");
    const match = upper.match(re);
    if (match && match[1]) {
      const cleaned = match[1].replace(/\D/g, "").slice(0, digits);
      if (cleaned.length === digits) return cleaned;
    }
  }
  return "";
}

function extractFirstNumber(text, digits) {
  const match = String(text || "").match(new RegExp(`\\b(\\d{${digits}})\\b`));
  return match ? match[1] : "";
}

function normalizeForLabelSearch(text) {
  return String(text || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function extractNumberNearLabel(text, labels, digits) {
  const norm = normalizeForLabelSearch(text);
  for (const label of labels) {
    const normLabel = normalizeForLabelSearch(label);
    const idx = norm.indexOf(normLabel);
    if (idx === -1) continue;
    const window = norm.slice(idx, idx + 120);
    const onlyDigits = window.replace(/\D/g, "");
    if (onlyDigits.length >= digits) return onlyDigits.slice(0, digits);
  }
  return "";
}

function extractNumberAfterLooseLabel(text, labels, digits) {
  const norm = normalizeForLabelSearch(text);
  for (const label of labels) {
    const normLabel = normalizeForLabelSearch(label);
    const re = new RegExp(normLabel + "[^0-9]{0,80}((?:\\d[\\s.-]*){" + digits + ",})");
    const m = norm.match(re);
    if (m && m[1]) {
      const onlyDigits = m[1].replace(/\\D/g, "");
      if (onlyDigits.length >= digits) return onlyDigits.slice(0, digits);
    }
  }
  return "";
}

function extractSiretFromGroupedText(text) {
  const t = String(text || "");
  const match = t.match(/(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{5})/);
  if (!match) return "";
  const siret = `${match[1]}${match[2]}${match[3]}${match[4]}`;
  return siret.length === 14 ? siret : "";
}

function extractSirenFromGroupedText(text) {
  const t = String(text || "");
  const match = t.match(/(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{3})/);
  if (!match) return "";
  const siren = `${match[1]}${match[2]}${match[3]}`;
  return siren.length === 9 ? siren : "";
}

function mergePreferNonEmpty(base, override) {
  const result = { ...(base || {}) };
  const src = override || {};
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (v != null && String(v).trim() !== "") {
      result[key] = v;
    }
  }
  return result;
}

async function ocrPdfViaApi(req, fileBase64, maxPages = 1) {
  try {
    const host = req?.headers?.host;
    if (!host) return "";
    const baseUrl = `http://${host}`;

    const res = await fetch(`${baseUrl}/api/ocr-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileBase64, maxPages }),
    });

    if (!res.ok) return "";
    const data = await res.json().catch(() => ({}));
    return (data?.texteCV || "").trim();
  } catch {
    return "";
  }
}
