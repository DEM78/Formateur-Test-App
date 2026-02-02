// workers/document-verifier/src/index.js
// ✅ Pièce d’identité — version robuste + IMPORTANT: ne bloque PAS si la date d’expiration n’est pas détectée
// (c’est exactement ce qui faisait “bugger” chez toi alors que Nom/Prénom étaient corrects)

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ valide: false, error: "Method not allowed" }, 405, corsHeaders);
    }

    try {
      const body = await request.json();
      const fileBase64 = body.fileBase64;

      // ✅ ton front envoie body.nom / body.prenom
      const nomAttendu = (body.nom || "").trim();
      const prenomAttendu = (body.prenom || "").trim();

      if (!fileBase64) {
        return jsonResponse({ valide: false, error: "fileBase64 manquant" }, 400, corsHeaders);
      }
      if (!nomAttendu || !prenomAttendu) {
        return jsonResponse({ valide: false, error: "Nom et prénom requis" }, 400, corsHeaders);
      }

      // base64 -> bytes
      const binaryString = atob(fileBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      // refuse PDF
      if (isPdf(bytes)) {
        return jsonResponse(
          { valide: false, error: "PDF non supporté. Envoie une image JPG/PNG." },
          200,
          corsHeaders
        );
      }

      // ========= OCR =========
      let ocrText = "";
      let ocrMethod = "none";

      // 1) OCR.space
      try {
        const cleanBase64 = fileBase64.replace(/^data:image\/\w+;base64,/, "");
        const formData = new FormData();
        formData.append("base64Image", `data:image/jpeg;base64,${cleanBase64}`);
        formData.append("language", "fre");
        formData.append("isOverlayRequired", "false");
        formData.append("detectOrientation", "true");
        formData.append("scale", "true");
        formData.append("OCREngine", "2");

        const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: { apikey: "K87899142388957" },
          body: formData,
        });

        const ocrData = await ocrResponse.json();

        if (
          ocrData?.OCRExitCode === 1 &&
          Array.isArray(ocrData?.ParsedResults) &&
          ocrData.ParsedResults.length > 0
        ) {
          ocrText = ocrData.ParsedResults[0].ParsedText || "";
          ocrMethod = "ocr.space";
        }
      } catch {
        // ignore
      }

      // 2) fallback Workers AI vision
      if (!ocrText || ocrText.length < 30) {
        try {
          if (env.AI) {
            const aiResponse = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
              image: Array.from(bytes),
              prompt:
                "Lis tout le texte visible sur cette carte d'identité française. " +
                "Recopie les lignes avec les libellés Nom/Surname, Prénoms/Given names, Date d'expiration/Expiry date.",
              max_tokens: 600,
            });

            const aiText = aiResponse?.description || aiResponse?.response || "";
            if (aiText && aiText.length > ocrText.length) {
              ocrText = aiText;
              ocrMethod = "workers-ai";
            }
          }
        } catch {
          // ignore
        }
      }

      if (!ocrText || ocrText.length < 20) {
        return jsonResponse(
          {
            valide: false,
            confiance: 0.1,
            details: "Impossible de lire le texte du document",
            debug: { ocrMethod, ocrTextLength: ocrText.length },
            comparaison: {
              nom_piece: "non détecté",
              nom_attendu: nomAttendu,
              nom_correspond: false,
              prenom_piece: "non détecté",
              prenom_attendu: prenomAttendu,
              prenom_correspond: false,
              date_expiration_piece: "non détecté",
              document_expire: null,
            },
          },
          200,
          corsHeaders
        );
      }

      // ========= Extraction ciblée =========
      const extracted = extractCniFieldsFromOcr(ocrText);

      // ========= Comparaison =========
      const nomCorrespond = compareTextRobust(extracted.nom, nomAttendu);
      const prenomCorrespond = prenomsAllExpectedInFound(extracted.prenom, prenomAttendu);

      // Expiration (optionnelle)
      const expiryInfo = parseExpiryDate(extracted.expiration);
      const documentExpire = expiryInfo.expired; // true | false | null

      // ✅ COMME TON CODE QUI MARCHAIT:
      // => valide si nom+prénom OK et document pas explicitement expiré
      // => si expiration non détectée (null) : on n’invalide pas
      const valide = nomCorrespond && prenomCorrespond && documentExpire !== true;

      // (optionnel) reason pour debug
      let reason = "";
      if (!nomCorrespond) reason = "nom_mismatch";
      else if (!prenomCorrespond) reason = "prenom_mismatch";
      else if (documentExpire === true) reason = "document_expire";
      else if (documentExpire === null) reason = "expiration_non_detectee"; // mais valide peut être true

      return jsonResponse(
        {
          valide,
          reason,
          confiance: valide ? 0.95 : 0.4,
          details: `Méthode: ${ocrMethod}`,
          debug: { ocrMethod, extracted, expiry: expiryInfo },
          comparaison: {
            nom_piece: extracted.nom || "non détecté",
            nom_attendu: nomAttendu,
            nom_correspond: nomCorrespond,
            prenom_piece: extracted.prenom || "non détecté",
            prenom_attendu: prenomAttendu,
            prenom_correspond: prenomCorrespond,
            date_expiration_piece: expiryInfo.iso || "non détecté",
            document_expire: documentExpire,
            texte_ocr_extrait: ocrText.substring(0, 1200),
          },
        },
        200,
        corsHeaders
      );
    } catch (err) {
      return jsonResponse(
        { valide: false, error: err.message || "Erreur interne", stack: err.stack },
        500,
        corsHeaders
      );
    }
  },
};

// =================== Extraction CNI ===================
// ✅ Anti “Name” (label) -> on ignore si valeur = "Name"
function extractCniFieldsFromOcr(text) {
  const result = { nom: "", prenom: "", expiration: "" };

  const clean = (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  const lines = clean
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  result.nom = extractValueForField(lines, {
    labels: [/(\b|^)NOM(\b|$)/i, /(\b|^)SURNAME(\b|$)/i, /(\b|^)NAME(\b|$)/i],
  });

  result.prenom = extractValueForField(lines, {
    labels: [/(\b|^)PR[EÉ]NOMS?(\b|$)/i, /(\b|^)GIVEN(\b|$)/i, /(\b|^)NAMES?(\b|$)/i],
  });

  result.expiration = extractValueForExpiry(lines);

  result.nom = sanitizeNameValue(result.nom, { forbidHeader: true });
  result.prenom = sanitizeNameValue(result.prenom, { forbidHeader: false });
  result.expiration = sanitizeExpiryValue(result.expiration);

  if (isBadName(result.nom)) result.nom = "";
  if (isBadName(result.prenom)) result.prenom = "";

  return result;
}

function extractValueForField(lines, { labels }) {
  // 1) même ligne
  for (const line of lines) {
    if (!labels.some((re) => re.test(line))) continue;

    const afterColon = line.split(/[:]/).slice(1).join(":").trim();
    const stripped = line
      .replace(/(NOM|SURNAME|NAME|PR[EÉ]NOMS?|GIVEN|NAMES?)/gi, "")
      .replace(/[\/]/g, " ")
      .trim();

    const candidate = (afterColon || stripped).trim();
    if (looksLikeName(candidate)) return candidate;
  }

  // 2) ligne suivante
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!labels.some((re) => re.test(line))) continue;

    const afterColon = line.split(/[:]/).slice(1).join(":").trim();
    if (afterColon && looksLikeName(afterColon)) return afterColon;

    const next = (lines[i + 1] || "").trim();
    if (looksLikeName(next)) return next;
  }

  return "";
}

function extractValueForExpiry(lines) {
  const expiryLabels = [/DATE\s+D['’]?\s*EXPIR/i, /\bEXPIRY\b/i, /\bEXPIRATION\b/i];

  for (const line of lines) {
    if (!expiryLabels.some((re) => re.test(line))) continue;

    const afterColon = line.split(/[:]/).slice(1).join(":").trim();
    const stripped = line.replace(/DATE\s+D['’]?\s*EXPIR\w*|EXPIRY|EXPIRATION/gi, "").trim();
    const candidate = (afterColon || stripped).trim();
    if (candidate) return candidate;
  }

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!expiryLabels.some((re) => re.test(line))) continue;

    const afterColon = line.split(/[:]/).slice(1).join(":").trim();
    if (afterColon) return afterColon;

    const next = (lines[i + 1] || "").trim();
    if (next) return next;
  }

  return "";
}

function looksLikeName(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t)) return false;
  if (isBadName(t)) return false;

  const cleaned = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, "").trim();
  return cleaned.length >= 2;
}

function isBadName(s) {
  const up = (s || "").trim().toUpperCase();
  return (
    up === "NAME" ||
    up === "SURNAME" ||
    up === "GIVEN" ||
    up === "GIVEN NAMES" ||
    up === "NOM" ||
    up === "PRENOM" ||
    up === "PRENOMS" ||
    up === "NAMES"
  );
}

function sanitizeNameValue(v, { forbidHeader }) {
  let s = (v || "").replace(/[|]/g, " ").replace(/\s{2,}/g, " ").trim();
  s = s.split(/SEXE|NATIONALIT|DATE\s+DE\s+NAISS|LIEU\s+DE\s+NAISS|DOCUMENT/i)[0].trim();

  if (forbidHeader) {
    const bad = [
      "RÉPUBLIQUE",
      "REPUBLIQUE",
      "FRANÇAISE",
      "FRANCAISE",
      "CARTE",
      "IDENTITE",
      "IDENTITY",
      "NATIONALE",
    ];
    const up = s.toUpperCase();
    for (const b of bad) if (up.includes(b)) return "";
  }

  s = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, " ").replace(/\s{2,}/g, " ").trim();
  return s;
}

function sanitizeExpiryValue(v) {
  let s = (v || "").trim();
  s = s.replace(/[^0-9\/\.\-\s]/g, " ").replace(/\s{2,}/g, " ").trim();
  return s;
}

// =================== Expiration parsing ===================
function parseExpiryDate(expStr) {
  const s = (expStr || "").trim();
  if (!s) return { date: null, expired: null, iso: "" };

  const m = s.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
  if (!m) return { date: null, expired: null, iso: "" };

  let dd = parseInt(m[1], 10);
  let mm = parseInt(m[2], 10);
  let yy = parseInt(m[3], 10);
  if (yy < 100) yy += 2000;

  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yy < 1900 || yy > 2200) {
    return { date: null, expired: null, iso: "" };
  }

  const date = new Date(Date.UTC(yy, mm - 1, dd, 23, 59, 59));
  const now = new Date();
  const expired = now.getTime() > date.getTime();

  const iso = `${String(dd).padStart(2, "0")}-${String(mm).padStart(2, "0")}-${yy}`;
  return { date, expired, iso };
}

// =================== Comparaison ===================
function compareTextRobust(text1, text2) {
  if (!text1 || !text2) return false;

  const normalize = (str) =>
    str
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "")
      .trim();

  const t1 = normalize(text1);
  const t2 = normalize(text2);
  if (!t1 || !t2) return false;

  if (t1 === t2) return true;
  if (t1.includes(t2) || t2.includes(t1)) return true;

  const dist = levenshteinDistance(t1, t2);
  const maxLen = Math.max(t1.length, t2.length);
  if (maxLen === 0) return false;

  const sim = 1 - dist / maxLen;
  return sim >= 0.85;
}

function prenomsAllExpectedInFound(found, expected) {
  if (!found || !expected) return false;

  const norm = (s) =>
    s
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z\s-]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

  const f = norm(found);
  const eParts = norm(expected).split(/[\s-]+/).filter(Boolean);

  if (!f || eParts.length === 0) return false;

  const fCompact = f.replace(/[\s-]+/g, " ");
  return eParts.every((p) => fCompact.includes(p));
}

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
    }
  }
  return dp[m][n];
}

function isPdf(bytes) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
