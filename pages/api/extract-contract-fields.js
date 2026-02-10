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
    const textByType = {};
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
        if (text && doc.type) {
          textByType[doc.type] = textByType[doc.type]
            ? `${textByType[doc.type]}\n${text}`
            : text;
        }
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
    const companyText = [
      textByType.kbis,
      textByType.recpActivite,
      textByType.urssaf,
      textByType.fiscale,
      textByType.assurance,
    ]
      .filter(Boolean)
      .join("\n");

    const extracted = extractPrestataireFields(allText, nom, prenom, companyText);
    const merged = mergePreferNonEmpty(workerExtracted, extracted);

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

function extractPrestataireFields(text, nom, prenom, companyText = "") {
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
    representant: `${prenom} ${nom}` ,
    fonction_representant: "",
  };

  const primaryText = companyText || text;

  // SIREN (9 chiffres)
  const siren =
    extractNumberAfterLabels(primaryText, ["SIREN", "S I R E N", "SIREN/", "NUMERO DE SIREN"], 9) ||
    extractNumberNearLabel(primaryText, ["SIREN", "NUMERO DE SIREN"], 9) ||
    extractSirenFromGroupedText(primaryText) ||
    extractFirstNumber(primaryText, 9);
  if (siren) prestataire.siren = siren;

  // SIRET (14 chiffres) - handle spaced groups like 123 456 789 00012
  const siret =
    extractNumberAfterLabels(primaryText, ["SIRET", "S I R E T", "SIRET/", "NUMERO DE SIRET", "N? SIRET", "N SIRET"], 14) ||
    extractNumberAfterLooseLabel(primaryText, ["SIRET", "NUMERO DE SIRET", "N? SIRET", "N SIRET"], 14) ||
    extractNumberNearLabel(primaryText, ["SIRET", "NUMERO DE SIRET"], 14) ||
    extractSiretFromGroupedText(primaryText) ||
    extractFirstNumber(primaryText, 14);
  if (siret) prestataire.siret = siret;

  // RCS
  const rcsMatch =
    primaryText.match(/RCS\s+([A-Z\s-]+)\s*(\d{9})?/i) ||
    primaryText.match(/REGISTRE\s+DU\s+COMMERCE\s+ET\s+DES\s+SOCIETES\s+([A-Z\s-]+)/i);
  if (rcsMatch) prestataire.rcs = rcsMatch[1].trim();

  // Denomination sociale
  const denomFromLabel =
    extractValueAfterLabel(primaryText, [
      "DENOMINATION SOCIALE",
      "DENOMINATION",
      "RAISON SOCIALE",
      "NOM COMMERCIAL",
      "DENOMINATION DE LA SOCIETE",
    ]) || "";

  const denomMatch =
    primaryText.match(/([A-Z0-9&\s'.-]{8,80})\s+SIREN/i);

  const denomRaw = (denomFromLabel || (denomMatch ? denomMatch[1] : "") || "")
    .replace(/SIREN.*$/i, "")
    .trim();
  const denom = selectDenomination(primaryText, denomRaw);
  if (denom) prestataire.denomination = denom;

  // Adresse (pattern francais)
  const adresseMatch =
    extractValueAfterLabel(primaryText, [
      "ADRESSE DU SIEGE",
      "ADRESSE DU PRINCIPAL ETABLISSEMENT",
      "ADRESSE POSTALE",
      "ADRESSE",
    ]) ||
    (primaryText.match(/(\d+\s+[^\n]{6,80}\s+\d{5}\s+[A-Z?-??-?][A-Za-z?-?\s-]+)/i)?.[1] || "");
  if (adresseMatch) {
    const fullAddr = adresseMatch;
    prestataire.adresse = fullAddr;

    // Extraire code postal et ville
    const cpVilleMatch = fullAddr.match(/(\d{5})[\s,]+([A-Z][a-z????\s-]+)/i);
    if (cpVilleMatch) {
      prestataire.code_postal = cpVilleMatch[1];
      prestataire.ville = cpVilleMatch[2].trim();
    }
  }

  // Fonction representant
  const fonctionMatch = primaryText.match(/(Gerant|President|Directeur)/i);
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
  const upper = normalizeForLabelSearch(String(text || ""));
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

function extractValueAfterLabel(text, labels) {
  const raw = String(text || "").replace(/\r/g, "");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1) Inline label: "LABEL: value"
  for (const label of labels) {
    const re = new RegExp(`${escapeRegex(label)}\\s*[:\\-]?\\s*([^\\n]{5,140})`, "i");
    const m = raw.match(re);
    if (m && m[1]) return m[1].trim();
  }

  // 2) Label then next line
  for (let i = 0; i < lines.length - 1; i++) {
    const lineNorm = normalizeForLabelSearch(lines[i]);
    for (const label of labels) {
      if (lineNorm.includes(normalizeForLabelSearch(label))) {
        const colonIdx = lines[i].indexOf(":");
        if (colonIdx !== -1) {
          const after = lines[i].slice(colonIdx + 1).trim();
          if (after && after.length >= 3) return after;
        }
        return lines[i + 1];
      }
    }
  }

  return "";
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function cleanFieldValue(value, stopTokens) {
  let v = String(value || "").trim();
  if (!v) return "";

  // cut at stop tokens if present
  const upper = v.toUpperCase();
  let cut = v.length;
  for (const token of stopTokens || []) {
    const pos = upper.indexOf(String(token || "").toUpperCase());
    if (pos !== -1 && pos < cut) cut = pos;
  }
  if (cut < v.length) v = v.slice(0, cut).trim();

  // remove trailing labels-like noise
  v = v.replace(/\s{2,}.*/g, "");
  return v.trim();
}


function cleanDenomination(value, stopTokens) {
  let v = String(value || "").trim();
  if (!v) return "";

  const lastColon = v.lastIndexOf(":");
  if (lastColon != -1 && lastColon < v.length - 1) {
    v = v.slice(lastColon + 1).trim();
  }

  v = v
    .replace(/^DE LA SOCIETE\s*/i, "")
    .replace(/^DE LA SOCI?T?\s*/i, "")
    .replace(/^NAME OF THE COMPANY\s*/i, "")
    .replace(/^DENOMINATION(\s+DE\s+LA\s+SOCIETE)?\s*/i, "")
    .trim();

  const upper = v.toUpperCase();
  let cut = v.length;
  for (const token of stopTokens || []) {
    const pos = upper.indexOf(String(token || "").toUpperCase());
    if (pos != -1 && pos < cut) cut = pos;
  }
  if (cut < v.length) v = v.slice(0, cut).trim();

  return v.trim();
}

function looksLikeAddress(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  if (/^\d{1,5}/.test(v)) return true;
  if (/\b(AVENUE|RUE|BOULEVARD|CHEMIN|IMPASSE|ALLEE|ALL?E|PLACE|QUAI|ROUTE)\b/i.test(v)) return true;
  return false;
}

function selectDenomination(primaryText, denomRaw) {
  const stopTokens = [
    "ADRESSE",
    "ADDRESS",
    "ADRESSE DU",
    "ADRESSE DE",
    "ADRESSE DU PRINCIPAL ETABLISSEMENT",
    "ADRESSE DU PRINCIPAL ?TABLISSEMENT",
    "ADRESSE POSTALE",
    "N? SIREN",
    "NUMERO SIREN",
    "SIRET",
    "CODE NAF",
  ];

  // 1) Prefer explicit label extraction
  const labelMatch = primaryText.match(new RegExp("(?:DENOMINATION(?:\\s+DE\\s+LA\\s+SOCIETE)?|DENOMINATION\\s+DE\\s+LA\\s+SOCIETE|NAME OF THE COMPANY)\\s*[:\\-]?\\s*([^\\n]{3,140})", "i"));
  if (labelMatch && labelMatch[1]) {
    const cleaned = cleanDenomination(labelMatch[1], stopTokens);
    if (cleaned && !looksLikeAddress(cleaned)) return cleaned;
  }

  // 2) Fallback to denomRaw if it does not look like an address
  const cand = cleanDenomination(denomRaw, stopTokens);
  if (cand && !looksLikeAddress(cand)) return cand;

  // 3) Try company form keywords
  const m2 = primaryText.match(/\b(SAS|SARL|SASU|SA|EURL|SCI|ASSOCIATION|ENTREPRISE)\b\s+([A-Z0-9& .-]{3,80})/i);
  if (m2) {
    const cleaned = cleanDenomination(`${m2[1]} ${m2[2]}`, stopTokens);
    if (cleaned && !looksLikeAddress(cleaned)) return cleaned;
  }

  return "";
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