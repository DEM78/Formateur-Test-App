// workers/document-extractor/src/index.js
// Extract key company fields from administrative PDFs (kbis, urssaf, fiscale, assurance, declaration).
import { extractText } from "unpdf";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed" }, 405, corsHeaders);
    }

    try {
      const body = await request.json();
      const fileBase64 = body?.fileBase64 || "";
      const docType = String(body?.docType || "").trim().toLowerCase();

      if (!fileBase64) {
        return jsonResponse({ success: false, error: "fileBase64 manquant" }, 400, corsHeaders);
      }

      // Decode base64 -> Uint8Array
      const bytes = base64ToUint8Array(fileBase64);
      if (!isPdf(bytes)) {
        return jsonResponse(
          { success: false, error: "PDF requis (base64)" },
          200,
          corsHeaders
        );
      }

      // 1) Extract text from PDF
      let fullText = "";
      try {
        const extractedData = await extractText(bytes, { mergePages: true });
        fullText = (extractedData?.text || "").trim();
      } catch {
        fullText = "";
      }

      // 2) Regex fallback (works even if text is short/partial)
      const regexExtract = extractCompanyFieldsFromText(fullText);

      if (!fullText || fullText.length < 80) {
        return jsonResponse(
          {
            success: true,
            extracted: regexExtract,
            meta: {
              warning:
                "Texte PDF trop faible (scan / image). Extraction partielle uniquement.",
              text_length: fullText?.length || 0,
            },
          },
          200,
          corsHeaders
        );
      }

      // 3) AI extraction (more robust)
      const ai = env.AI;
      let aiExtract = {};

      if (ai) {
        const messages = [
          {
            role: "system",
            content:
              "Tu es un extracteur d'informations de documents d'entreprise francais. " +
              "Reponds UNIQUEMENT en JSON valide, sans aucun texte autour.\n\n" +
              "JSON attendu:\n" +
              "{\n" +
              '  "siren": "",\n' +
              '  "siret": "",\n' +
              '  "rcs": "",\n' +
              '  "denomination": "",\n' +
              '  "adresse": "",\n' +
              '  "date_emission": "",\n' +
              '  "date_expiration": ""\n' +
              "}\n\n" +
              "Contraintes:\n" +
              "- Si une info est absente: \"\"\n" +
              "- siren = 9 chiffres, siret = 14 chiffres\n" +
              "- denomination = raison sociale\n" +
              "- adresse = rue + code postal + ville si present\n" +
              "- date_emission / date_expiration au format JJ-MM-AAAA si detectables",
          },
          {
            role: "user",
            content:
              `Type de document: ${docType || "inconnu"}\n\n` +
              "Extrait les informations de ce document.\n\n" +
              fullText.slice(0, 9000),
          },
        ];

        const modelId = "@cf/meta/llama-3.1-8b-instruct";
        const response = await ai.run(modelId, {
          messages,
          max_tokens: 500,
          temperature: 0.1,
        });

        const responseText = (response?.response || "").trim();
        aiExtract = safeJsonFromModelText(responseText);
      }

      const cleaned = normalizeCompanyExtract({
        siren: aiExtract?.siren || regexExtract.siren,
        siret: aiExtract?.siret || regexExtract.siret,
        rcs: aiExtract?.rcs || regexExtract.rcs,
        denomination: aiExtract?.denomination || regexExtract.denomination,
        adresse: aiExtract?.adresse || regexExtract.adresse,
        date_emission: aiExtract?.date_emission || "",
        date_expiration: aiExtract?.date_expiration || "",
      });

      return jsonResponse(
        {
          success: true,
          extracted: cleaned,
          meta: {
            text_length: fullText.length,
            model: ai ? "@cf/meta/llama-3.1-8b-instruct" : "none",
          },
        },
        200,
        corsHeaders
      );
    } catch (err) {
      return jsonResponse(
        { success: false, error: err?.message || "Erreur interne" },
        500,
        corsHeaders
      );
    }
  },
};

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function base64ToUint8Array(base64) {
  const clean = String(base64).replace(/^data:.*;base64,/, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function isPdf(bytes) {
  return bytes?.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function extractCompanyFieldsFromText(text) {
  const t = normalizeText(text);

  const siren =
    extractNumberAfterLabels(t, ["SIREN", "S I R E N", "SIREN/", "NUMERO DE SIREN", "NUM\u00C9RO DE SIREN"], 9) ||
    extractNumberNearLabel(t, ["SIREN", "NUMERO DE SIREN", "NUM\u00C9RO DE SIREN"], 9) ||
    extractSirenFromGroupedText(t) ||
    extractFirstNumber(t, 9);
  const siret =
    extractNumberAfterLabels(t, ["SIRET", "S I R E T", "SIRET/", "NUMERO DE SIRET", "NUM\u00C9RO DE SIRET", "N° SIRET", "N SIRET"], 14) ||
    extractNumberAfterLooseLabel(t, ["SIRET", "NUMERO DE SIRET", "NUM\u00C9RO DE SIRET", "N° SIRET", "N SIRET"], 14) ||
    extractNumberNearLabel(t, ["SIRET", "NUMERO DE SIRET", "NUM\u00C9RO DE SIRET"], 14) ||
    extractSiretFromGroupedText(t) ||
    extractFirstNumber(t, 14);

  const rcsMatch =
    t.match(/RCS\s+([A-Z\s-]+)\s*(\d{9})?/i) ||
    t.match(/REGISTRE\s+DU\s+COMMERCE\s+ET\s+DES\s+SOCIETES\s+([A-Z\s-]+)/i);
  const rcs = rcsMatch ? rcsMatch[1].trim() : "";

  const denomMatch =
    t.match(/D(?:\u00C9|E)NOMINATION\s*(SOCIALE)?[:\s]+([^\n]{5,120})/i) ||
    t.match(/RAISON\s+SOCIALE[:\s]+([^\n]{5,120})/i) ||
    t.match(/NOM\s+COMMERCIAL[:\s]+([^\n]{5,120})/i) ||
    t.match(/([A-Z0-9&\s'.-]{8,80})\s+SIREN/i);
  const denomination = denomMatch ? String(denomMatch[2] || denomMatch[1] || "").replace(/\s{2,}/g, " ").trim() : "";

  const adresseMatch =
    t.match(/(\d+\s+[^\n]{6,80}\s+\d{5}\s+[A-Z][A-Za-z\s-]+)/i) ||
    t.match(/ADRESSE\s+[:\-]?\s*([^\n]{10,120})/i);
    t.match(/(\d+\s+[^\n]{6,80}\s+\d{5}\s+[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ\s-]+)/i) ||
    t.match(/ADRESSE\s+[:\-]?\s*([^\n]{10,120})/i);
  const adresse = adresseMatch ? adresseMatch[1].trim() : "";

  return { siren, siret, rcs, denomination, adresse };
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
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

function normalizeCompanyExtract(data) {
  return {
    siren: String(data?.siren || "").replace(/\D/g, "").slice(0, 9),
    siret: String(data?.siret || "").replace(/\D/g, "").slice(0, 14),
    rcs: String(data?.rcs || "").trim(),
    denomination: String(data?.denomination || "").trim(),
    adresse: String(data?.adresse || "").trim(),
    date_emission: String(data?.date_emission || "").trim(),
    date_expiration: String(data?.date_expiration || "").trim(),
  };
}

function safeJsonFromModelText(text) {
  try {
    const direct = JSON.parse(text);
    return direct && typeof direct === "object" ? direct : {};
  } catch {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
}
