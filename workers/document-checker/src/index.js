// workers/document-checker/src/index.js
// Document checker global: URSSAF / fiscale / assurance / casier / diplome / declaration / kbis / rib
// - input: pdf_text OR image base64
// - output: OK / REVIEW / FAIL

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return jsonResponse({ status: "FAIL", reason: "method_not_allowed" }, 405, corsHeaders);

    try {
      const body = await request.json().catch(() => ({}));

      const docType = (body.docType || "").trim().toLowerCase();
      const contentType = (body.contentType || "").trim().toLowerCase();
      const refNom = (body?.referenceData?.nom || "").trim();
      const refPrenom = (body?.referenceData?.prenom || "").trim();

      if (!docType) return jsonResponse({ status: "REVIEW", reason: "missing_docType", message: "docType manquant" }, 400, corsHeaders);
      if (!refNom || !refPrenom) {
        return jsonResponse({ status: "REVIEW", reason: "missing_reference", message: "Nom/Prénom requis" }, 200, corsHeaders);
      }

      // -------- 1) Get text (pdf_text OR OCR image) --------
      let text = "";
      let ocrMethod = "none";

      if (contentType === "pdf_text") {
        text = (body.text || "").toString();
        ocrMethod = "pdf_text";
      } else if (contentType === "image") {
        const fileBase64 = body.fileBase64;
        if (!fileBase64) {
          return jsonResponse({ status: "REVIEW", reason: "missing_fileBase64", message: "fileBase64 manquant" }, 400, corsHeaders);
        }

        // base64 -> bytes (for pdf detection and vision model)
        const bytes = base64ToUint8Array(fileBase64);

        if (isPdf(bytes)) {
          // ton front envoie normalement pdf_text, mais au cas où :
          return jsonResponse(
            {
              status: "REVIEW",
              reason: "pdf_received",
              message: "PDF reçu en image. Envoie pdf_text (extraction) ou une image JPG/PNG.",
              debug: { ocrMethod: "pdf_detected" },
            },
            200,
            corsHeaders
          );
        }

        // OCR.space first (si clé dispo)
        const ocrSpaceKey = env?.OCR_SPACE_KEY; // secret
        if (ocrSpaceKey) {
          try {
            const cleanBase64 = String(fileBase64).replace(/^data:image\/\w+;base64,/, "");
            const formData = new FormData();
            formData.append("base64Image", `data:image/jpeg;base64,${cleanBase64}`);
            formData.append("language", "fre");
            formData.append("isOverlayRequired", "false");
            formData.append("detectOrientation", "true");
            formData.append("scale", "true");
            formData.append("OCREngine", "2");

            const ocrRes = await fetch("https://api.ocr.space/parse/image", {
              method: "POST",
              headers: { apikey: ocrSpaceKey },
              body: formData,
            });

            const ocrData = await ocrRes.json().catch(() => ({}));
            if (ocrData?.OCRExitCode === 1 && Array.isArray(ocrData?.ParsedResults) && ocrData.ParsedResults.length > 0) {
              text = ocrData.ParsedResults[0].ParsedText || "";
              ocrMethod = "ocr.space";
            }
          } catch {
            // ignore
          }
        }

        // Fallback Workers AI vision
        if ((!text || text.length < 80) && env.AI) {
          try {
            const aiRes = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
              image: Array.from(bytes),
              prompt:
                "Lis le texte de ce document administratif français. " +
                "Recopie tout ce qui est lisible, surtout: nom, prénom, dates (délivré le / valable jusqu'au / expiration), organismes (URSSAF, DGFIP, RCS, KBIS, assurance, casier judiciaire).",
              max_tokens: 900,
            });

            const aiText = aiRes?.description || aiRes?.response || "";
            if (aiText && aiText.length > (text?.length || 0)) {
              text = aiText;
              ocrMethod = "workers-ai";
            }
          } catch {
            // ignore
          }
        }
      } else {
        return jsonResponse(
          { status: "REVIEW", reason: "bad_contentType", message: "contentType doit être image ou pdf_text" },
          400,
          corsHeaders
        );
      }

      const cleanText = normalizeDocText(text);
      if (!cleanText || cleanText.length < 60) {
        return jsonResponse(
          {
            status: "REVIEW",
            reason: "unreadable",
            message: "⚠️ Texte illisible (scan / mauvaise qualité). Essaie une image plus nette ou un PDF texte.",
            debug: { ocrMethod, textLength: cleanText.length },
          },
          200,
          corsHeaders
        );
      }

      // -------- 2) Check doc type "signature" keywords --------
      if (docType === "diplome") {
        return jsonResponse(
          {
            status: "OK",
            reason: "diplome_always_ok",
            confidence: 0.5,
            message: "✅ Document cohérent",
            extracted: { keywordsScore: 0 },
            debug: { ocrMethod, textLength: cleanText.length },
          },
          200,
          corsHeaders
        );
      }
      const signature = getDocSignature(docType);
      const keywordsScore = signature.keywords
        ? scoreKeywords(cleanText, signature.keywords)
        : 0;

      // si c'est clairement un autre type de doc
      if (signature.strictFailKeywords?.length) {
        const wrongHits = signature.strictFailKeywords.filter((k) => includesLoose(cleanText, k)).length;
        if (wrongHits >= 2 && keywordsScore === 0) {
          return jsonResponse(
            {
              status: "FAIL",
              reason: "wrong_doc_type",
              confidence: 0.9,
              message: "❌ Document ne semble pas correspondre au type demandé",
              extracted: { keywordsScore, wrongHits },
              debug: { ocrMethod, textLength: cleanText.length },
            },
            200,
            corsHeaders
          );
        }
      }

      // seuil minimal
      if (signature.minKeywordsScore != null && keywordsScore < signature.minKeywordsScore) {
        return jsonResponse(
          {
            status: "REVIEW",
            reason: "low_keyword_match",
            confidence: 0.45,
            message: "⚠️ Type du document incertain (mots-clés insuffisants) — à vérifier",
            extracted: { keywordsScore },
            debug: { ocrMethod, textLength: cleanText.length },
          },
          200,
          corsHeaders
        );
      }

      // -------- 2b) Required groups / patterns (strong official anchors) --------
      if (signature.requiredGroups?.length) {
        const groupsOk = requiredGroupsSatisfied(cleanText, signature.requiredGroups);
        if (!groupsOk) {
          const status = cleanText.length < 120 ? "REVIEW" : "FAIL";
          return jsonResponse(
            {
              status,
              reason: "missing_required_markers",
              confidence: status === "FAIL" ? 0.85 : 0.55,
              message:
                status === "FAIL"
                  ? "❌ Document ne contient pas les marqueurs officiels requis"
                  : "⚠️ Marqueurs officiels insuffisants (qualité faible) — à vérifier",
              extracted: { keywordsScore },
              debug: { ocrMethod, textLength: cleanText.length },
            },
            200,
            corsHeaders
          );
        }
      }

      if (signature.requiredRegex?.length) {
        const regexOk = signature.requiredRegex.every((re) => re.test(cleanText));
        if (!regexOk) {
          const status = cleanText.length < 120 ? "REVIEW" : "FAIL";
          return jsonResponse(
            {
              status,
              reason: "missing_required_patterns",
              confidence: status === "FAIL" ? 0.85 : 0.55,
              message:
                status === "FAIL"
                  ? "❌ Formats obligatoires absents (ex: IBAN/BIC/numéro officiel)"
                  : "⚠️ Formats officiels non détectés (qualité faible) — à vérifier",
              extracted: { keywordsScore },
              debug: { ocrMethod, textLength: cleanText.length },
            },
            200,
            corsHeaders
          );
        }
      }

      // -------- 3) Extract name + compare --------
      const extractedNames = extractNameFromText(cleanText);
      const nomOk = compareTextRobust(extractedNames.nom, refNom);
      const prenomOk = prenomsAllExpectedInFound(extractedNames.prenom, refPrenom);

      const ignoreNameCheck = shouldIgnoreNameCheck(docType);

      // name mismatch = REVIEW (sauf docs entreprise où on ignore)
      let namePenalty = 0;
      if (!ignoreNameCheck && (extractedNames.nom || extractedNames.prenom)) {
        if (!nomOk) namePenalty += 1;
        if (!prenomOk) namePenalty += 1;
      }

      // -------- 4) Extract dates and apply validity rules --------
      const dates = extractDates(cleanText);
      const now = new Date();

      // règles par type
      const validity = evaluateValidityByType(docType, dates, now);

      // -------- 4b) Extract company fields (SIREN/SIRET/...) --------
      const companyFields = extractCompanyFields(cleanText);
      const aiCompanyFields =
        (!companyFields.siren || !companyFields.siret || !companyFields.denomination) && env.AI
          ? await extractCompanyFieldsWithAI(cleanText, env).catch(() => ({}))
          : {};
      const mergedCompany = {
        siren: companyFields.siren || aiCompanyFields.siren || "",
        siret: companyFields.siret || aiCompanyFields.siret || "",
        rcs: companyFields.rcs || aiCompanyFields.rcs || "",
        denomination: companyFields.denomination || aiCompanyFields.denomination || "",
        adresse: companyFields.adresse || aiCompanyFields.adresse || "",
      };

      // -------- 5) Decide status --------
      // FAIL si expiré clair
      if (validity.expired === true) {
        return jsonResponse(
          {
            status: "FAIL",
            reason: "expired",
            confidence: 0.95,
            message: "❌ Document expiré",
            extracted: {
              foundName: extractedNames.nom || "",
              foundFirstName: extractedNames.prenom || "",
              dates: validity,
              keywordsScore,
              company: mergedCompany,
            },
            debug: { ocrMethod, textLength: cleanText.length },
          },
          200,
          corsHeaders
        );
      }

      // FAIL si très sûr que ce n’est pas le bon doc (keywords ok déjà gérés plus haut)
      // sinon name mismatch → REVIEW
      if (!ignoreNameCheck && namePenalty >= 2 && (extractedNames.nom || extractedNames.prenom)) {
        return jsonResponse(
          {
            status: "REVIEW",
            reason: "name_mismatch",
            confidence: 0.55,
            message: `⚠️ Nom/Prénom détectés ne correspondent pas (à vérifier)`,
            extracted: {
              foundName: extractedNames.nom || "",
              foundFirstName: extractedNames.prenom || "",
              dates: validity,
              keywordsScore,
              company: mergedCompany,
            },
            debug: { ocrMethod, textLength: cleanText.length },
          },
          200,
          corsHeaders
        );
      }

      // si doc nécessite une date mais qu’on ne l’a pas → REVIEW
      if (validity.requiresDate === true && validity.hasUsableDate !== true) {
        return jsonResponse(
          {
            status: "REVIEW",
            reason: "no_date",
            confidence: 0.55,
            message: "⚠️ Date de validité/émission introuvable (scan ou format). À vérifier.",
            extracted: {
              foundName: extractedNames.nom || "",
              foundFirstName: extractedNames.prenom || "",
              dates: validity,
              keywordsScore,
              company: mergedCompany,
            },
            debug: { ocrMethod, textLength: cleanText.length },
          },
          200,
          corsHeaders
        );
      }

      // OK si keywords OK + pas expiré + (nom/prénom OK ou non détecté)
      const confidence =
        0.65 +
        Math.min(0.25, keywordsScore * 0.05) +
        (validity.expired === false ? 0.05 : 0) +
        (nomOk && prenomOk ? 0.05 : 0) -
        (namePenalty ? 0.1 : 0);

      return jsonResponse(
        {
          status: "OK",
          reason: "ok",
          confidence: clamp(confidence, 0, 0.99),
          message: "✅ Document cohérent",
          extracted: {
            foundName: extractedNames.nom || "",
            foundFirstName: extractedNames.prenom || "",
            dates: validity,
            keywordsScore,
            company: mergedCompany,
          },
          debug: { ocrMethod, textLength: cleanText.length },
        },
        200,
        corsHeaders
      );
    } catch (err) {
      return jsonResponse(
        {
          status: "REVIEW",
          reason: "internal_error",
          message: "⚠️ Vérification automatique indisponible (à vérifier)",
          error: err?.message || "Erreur interne",
        },
        200,
        corsHeaders
      );
    }
  },
};

// ---------------- helpers ----------------

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

function normalizeDocText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function includesLoose(haystack, needle) {
  const h = normalizeForMatch(haystack);
  const n = normalizeForMatch(needle);
  return h.includes(n);
}

function scoreKeywords(text, keywords) {
  const t = normalizeForMatch(text);
  let score = 0;
  for (const group of keywords) {
    // group = array of synonyms => +1 if any match
    if (group.some((kw) => t.includes(normalizeForMatch(kw)))) score += 1;
  }
  return score;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeForMatch(input) {
  return String(input || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shouldIgnoreNameCheck(docType) {
  // Docs entreprise: on vérifie la conformité du document, pas le nom/prénom du formateur
  return ["urssaf", "fiscale", "assurance", "declaration", "kbis", "rib"].includes(docType);
}

function requiredGroupsSatisfied(text, groups) {
  const upper = normalizeForMatch(text);
  return groups.every((group) =>
    group.some((g) => {
      if (g instanceof RegExp) return g.test(text);
      return upper.includes(normalizeForMatch(g));
    })
  );
}

// ---------------- doc signatures ----------------

function getDocSignature(docType) {
  // keywords: tableau de groupes (synonymes). Score = nombre de groupes matchés.
  // minKeywordsScore: seuil minimal pour éviter n’importe quoi.

  const commonWrong = [
    "CARTE NATIONALE D'IDENTITE",
    "CARTE D'IDENTIT",
    "PASSPORT",
    "PERMIS DE CONDUIRE",
    "CV",
    "CURRICULUM VITAE",
  ];

  switch (docType) {
    case "urssaf":
      return {
        keywords: [
          ["URSSAF", "ACOSS"],
          ["ATTESTATION", "VIGILANCE"],
          ["COTISATION", "CONTRIBUTION"],
          ["SIRET", "SIREN"],
        ],
        minKeywordsScore: 3,
        requiredGroups: [
          ["URSSAF", "ACOSS"],
          ["ATTESTATION", "VIGILANCE", "FOURNITURE"],
          ["COTISATION", "CONTRIBUTION", "DECLARATIONS SOCIALES"],
          ["CODE DE SECURITE", "CODE DE SÉCURITÉ", "ARTICLE L.243-15", "VERIFICATION-ATTESTATION", "VERIFICATION ATTESTATION"],
        ],
        strictFailKeywords: commonWrong,
      };

    case "fiscale":
      return {
        keywords: [
          ["DGFIP", "IMPOTS.GOUV", "DIRECTION GENERALE DES FINANCES PUBLIQUES"],
          ["ATTESTATION", "REGULARITE FISCALE", "FISCALE"],
          ["IMPOT", "TVA", "CFE"],
          ["SIRET", "SIREN"],
        ],
        minKeywordsScore: 3,
        requiredGroups: [
          ["DGFIP", "DIRECTION GENERALE DES FINANCES PUBLIQUES", "IMPOTS.GOUV"],
          ["ATTESTATION DE REGULARITE FISCALE", "ATTESTATION FISCALE"],
          ["SIREN", "N° SIREN", "TAX IDENTIFICATION NUMBER"],
          ["DATE DE DELIVRANCE", "DATE OF ISSUE"],
        ],
        strictFailKeywords: commonWrong,
      };

    case "assurance":
      return {
        keywords: [
          ["ATTESTATION", "ASSURANCE"],
          ["RESPONSABILITE CIVILE", "RC PRO", "RCP"],
          ["PROFESSIONNEL", "ACTIVITE"],
        ],
        minKeywordsScore: 2,
        requiredGroups: [
          ["ATTESTATION", "ATTESTE"],
          ["RESPONSABILITE CIVILE", "RC PRO", "RCP"],
          ["CONTRAT", "POLICE", "N°", "NUMERO"],
          ["VALABLE DU", "PERIODE", "AU "],
        ],
        strictFailKeywords: commonWrong,
      };

    case "casier":
      return {
        keywords: [
          ["CASIER JUDICIAIRE", "BULLETIN N", "BULLETIN N°", "BULLETIN NO"],
          ["MINISTERE", "JUSTICE"],
          ["NEANT", "AUCUNE CONDAMNATION", "NEANT AU CASIER"],
        ],
        minKeywordsScore: 2,
        requiredGroups: [
          ["MINISTERE DE LA JUSTICE", "MINISTÈRE DE LA JUSTICE"],
          ["CASIER JUDICIAIRE"],
          ["BULLETIN NUMERO 3", "BULLETIN NUMÉRO 3", "BULLETIN N° 3", "BULLETIN N°3"],
          ["DATE DE DELIVRANCE", "BULLETIN DELIVRE LE", "DATE DE DÉLIVRANCE"],
        ],
        strictFailKeywords: commonWrong,
      };

    case "diplome":
      return {
        keywords: [
          ["DIPLOME", "CERTIFICAT", "ATTESTATION DE REUSSITE"],
          ["UNIVERSITE", "ECOLE", "ACADEMIE", "INSTITUT"],
          ["ANNEE", "PROMOTION", "SESSION"],
        ],
        minKeywordsScore: 2,
        requiredGroups: [
          ["DIPLOME", "CERTIFICAT", "ATTESTATION DE REUSSITE"],
          ["UNIVERSITE", "ECOLE", "ACADEMIE", "INSTITUT"],
        ],
        strictFailKeywords: commonWrong,
      };

    case "declaration":
      return {
        keywords: [
          ["DECLARATION D'ACTIVITE", "DÉCLARATION D'ACTIVIT", "RECEPISSE DE DECLARATION", "RÉCÉPISSÉ DE DÉCLARATION"],
          ["DREETS", "DIRECCTE", "DRIEETS"],
          ["NUMERO DE DECLARATION", "N° DE DECLARATION", "N° D'ENREGISTREMENT"],
        ],
        minKeywordsScore: 2,
        requiredGroups: [
          ["DECLARATION D'ACTIVITE", "DÉCLARATION D'ACTIVIT", "DECLARATION D ACTIVITE", "RECEPISSE DE DECLARATION", "RÉCÉPISSÉ DE DÉCLARATION"],
          ["DREETS", "DIRECCTE", "DRIEETS"],
          ["NUMERO DE DECLARATION", "N° DE DECLARATION", "N° D'ENREGISTREMENT", "NUMERO D'ENREGISTREMENT"],
          ["PRESTATAIRE DE FORMATION", "FORMATION PROFESSIONNELLE", "PREFET", "PRÉFET"],
        ],
        strictFailKeywords: commonWrong,
      };

    case "rib":
      return {
        keywords: [
          ["RELEVE D'IDENTITE BANCAIRE", "RELEVÉ D'IDENTITÉ BANCAIRE", "RIB"],
          ["IBAN"],
          ["BIC"],
          ["TITULAIRE", "NOM DU TITULAIRE", "NOM"],
          ["DOMICILIATION", "AGENCE", "ETABLISSEMENT", "BANQUE"],
        ],
        minKeywordsScore: 3,
        requiredGroups: [
          ["RELEVE D'IDENTITE BANCAIRE", "RELEVÉ D'IDENTITÉ BANCAIRE", "RIB"],
          ["IBAN"],
          ["BIC"],
          ["TITULAIRE", "NOM DU TITULAIRE", "TITULAIRE DU COMPTE"],
        ],
        requiredRegex: [
          /\b[A-Z]{2}\s*\d{2}(?:\s*[A-Z0-9]){11,30}\b/i, // IBAN (avec espaces)
          /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?\b/i, // BIC
        ],
        strictFailKeywords: commonWrong,
      };

    case "kbis":
      return {
        keywords: [
          ["KBIS", "EXTRAIT"],
          ["RCS", "REGISTRE DU COMMERCE"],
          ["SIREN", "SIRET"],
          ["GREFFE", "TRIBUNAL DE COMMERCE"],
        ],
        minKeywordsScore: 3,
        requiredGroups: [
          ["EXTRAIT KBIS", "EXTRAIT K BIS", "EXTRAIT K-BIS"],
          ["RCS", "REGISTRE DU COMMERCE"],
          ["GREFFE", "TRIBUNAL", "INFOGREFFE", "CONTROLE.INFOGREFFE.FR"],
        ],
        requiredRegex: [
          /\b\d{9}\b/, // SIREN (souvent présent sans libellé)
        ],
        strictFailKeywords: commonWrong,
      };

    default:
      return {
        keywords: [],
        minKeywordsScore: 0,
        strictFailKeywords: commonWrong,
      };
  }
}

// ---------------- name extraction / compare (reprend ton style) ----------------

function extractNameFromText(text) {
  // très simple: cherche lignes contenant NOM / PRENOM / GIVEN / SURNAME, sinon vide
  const lines = normalizeDocText(text).split("\n").map((l) => l.trim()).filter(Boolean);

  const nom = extractValueForLabels(lines, [/(\b|^)NOM(\b|$)/i, /(\b|^)SURNAME(\b|$)/i, /(\b|^)NAME(\b|$)/i]);
  const prenom = extractValueForLabels(lines, [/(\b|^)PRENOM(\b|$)/i, /PR[EÉ]NOMS?/i, /GIVEN/i]);

  return {
    nom: sanitizeName(nom),
    prenom: sanitizeName(prenom),
  };
}

function extractValueForLabels(lines, labels) {
  // même ligne : "NOM: DUPONT"
  for (const line of lines) {
    if (!labels.some((re) => re.test(line))) continue;
    const afterColon = line.split(/[:]/).slice(1).join(":").trim();
    const stripped = line.replace(/NOM|SURNAME|NAME|PR[EÉ]NOMS?|PRENOM|GIVEN/gi, "").replace(/[\/]/g, " ").trim();
    const cand = (afterColon || stripped).trim();
    if (looksLikeName(cand)) return cand;
  }
  // ligne suivante
  for (let i = 0; i < lines.length - 1; i++) {
    if (!labels.some((re) => re.test(lines[i]))) continue;
    const next = (lines[i + 1] || "").trim();
    if (looksLikeName(next)) return next;
  }
  return "";
}

function looksLikeName(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 2 || t.length > 70) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t)) return false;
  return true;
}

function sanitizeName(v) {
  return String(v || "")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compareTextRobust(text1, text2) {
  if (!text1 || !text2) return false;

  const normalize = (str) =>
    String(str)
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
    String(s)
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
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
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

// ---------------- date extraction ----------------

function extractDates(text) {
  const t = normalizeDocText(text);

  // 1) formats dd/mm/yyyy etc.
  const numericDates = [...t.matchAll(/(\d{1,2})[\/\.\- ](\d{1,2})[\/\.\- ](\d{2,4})/g)]
    .map((m) => toDateSafe(m[1], m[2], m[3]))
    .filter(Boolean);

  // 2) formats "1 janvier 2025"
  const monthDates = [...t.matchAll(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/gi)]
    .map((m) => toDateMonthSafe(m[1], m[2], m[3]))
    .filter(Boolean);

  const all = [...numericDates, ...monthDates].sort((a, b) => a.getTime() - b.getTime());

  // heuristiques “issue” vs “expiry”
  const expiry = findDateNearLabels(t, all, ["VALABLE JUSQU", "EXPIR", "ECHEANCE", "JUSQU AU", "JUSQU'"]);
  const issue = findDateNearLabels(t, all, ["DELIVR", "EMIS", "FAIT LE", "DATE DU", "ETABLI LE", "ETABLIE LE"]);

  return { all, issue, expiry };
}

function toDateSafe(dd, mm, yy) {
  let d = parseInt(dd, 10);
  let m = parseInt(mm, 10);
  let y = parseInt(yy, 10);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2200) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function toDateMonthSafe(dd, monthStr, yyyy) {
  const months = {
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  };
  const d = parseInt(dd, 10);
  const m = months[String(monthStr).toLowerCase()] || 0;
  const y = parseInt(yyyy, 10);
  if (!m || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function findDateNearLabels(text, dates, labels) {
  // on cherche la première date qui apparaît proche d’un label
  const upper = text.toUpperCase();
  for (const label of labels) {
    const idx = upper.indexOf(label);
    if (idx === -1) continue;

    // prend la date la plus proche après idx
    let best = null;
    let bestDist = Infinity;
    for (const d of dates) {
      const iso = toIsoLike(d); // dd-mm-yyyy
      const pos = upper.indexOf(iso.split("-").reverse().join("-")); // pas fiable
      // fallback: on ne se base pas sur pos exact; on garde heuristique simple:
      // => si label trouvé, on préfère la plus récente comme expiry
      // Ici: on renvoie la plus récente pour expiry, la plus ancienne pour issue
    }
  }
  return null;
}

function toIsoLike(d) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}-${mm}-${yy}`;
}

// ---------------- validity rules per doc ----------------

function evaluateValidityByType(docType, datesObj, now) {
  const all = datesObj?.all || [];
  const issue = datesObj?.issue || null;
  const expiry = datesObj?.expiry || null;

  // helpers
  const latest = all.length ? all[all.length - 1] : null;
  const earliest = all.length ? all[0] : null;

  // Defaults
  let requiresDate = false;
  let hasUsableDate = false;
  let expired = null;

  // Pick best guess dates
  const guessedIssue = issue || earliest;
  const guessedExpiry = expiry || latest;

  const nowMs = now.getTime();

  if (docType === "diplome") {
    // diplome: pas d'expiration
    requiresDate = false;
    hasUsableDate = true;
    expired = false;
    return {
      issue: guessedIssue ? toIsoLike(guessedIssue) : "",
      expiry: "",
      expired,
      requiresDate,
      hasUsableDate,
      rule: "no_expiry_expected",
    };
  }

  if (docType === "rib") {
    // RIB: pas d'expiration
    requiresDate = false;
    hasUsableDate = true;
    expired = false;
    return {
      issue: "",
      expiry: "",
      expired,
      requiresDate,
      hasUsableDate,
      rule: "no_expiry_expected",
    };
  }

  if (docType === "kbis") {
    // KBIS: souvent demandé récent (3 mois). Ici on met 6 mois => OK sinon REVIEW (pas FAIL)
    requiresDate = true;
    if (!guessedIssue && !guessedExpiry) {
      return { issue: "", expiry: "", expired: null, requiresDate, hasUsableDate: false, rule: "kbis_missing_date" };
    }
    hasUsableDate = true;

    const basis = guessedIssue || guessedExpiry;
    const ageDays = Math.floor((nowMs - basis.getTime()) / (1000 * 60 * 60 * 24));

    // pas "expiré" strict, mais ancien
    expired = false;
    return {
      issue: guessedIssue ? toIsoLike(guessedIssue) : "",
      expiry: "",
      expired,
      requiresDate,
      hasUsableDate,
      rule: ageDays <= 180 ? "kbis_recent_ok" : "kbis_old_review",
      ageDays,
      reviewRecommended: ageDays > 180,
    };
  }

  if (docType === "casier") {
    // casier: souvent < 3 mois
    requiresDate = true;
    const basis = guessedIssue || guessedExpiry;
    if (!basis) return { issue: "", expiry: "", expired: null, requiresDate, hasUsableDate: false, rule: "casier_missing_date" };
    hasUsableDate = true;

    const ageDays = Math.floor((nowMs - basis.getTime()) / (1000 * 60 * 60 * 24));
    expired = false;
    return {
      issue: guessedIssue ? toIsoLike(guessedIssue) : "",
      expiry: "",
      expired,
      requiresDate,
      hasUsableDate,
      rule: ageDays <= 90 ? "casier_recent_ok" : "casier_old_review",
      ageDays,
      reviewRecommended: ageDays > 90,
    };
  }

  // declaration: pas d'expiration claire, on ne bloque pas sur la date
  if (docType === "declaration") {
    requiresDate = false;
    hasUsableDate = true;
    expired = false;
    return {
      issue: guessedIssue ? toIsoLike(guessedIssue) : "",
      expiry: "",
      expired,
      requiresDate,
      hasUsableDate,
      rule: "no_expiry_expected",
    };
  }

  // urssaf / fiscale / assurance:
  // on évite FAIL sur date trop ancienne (souvent date d'émission, pas une vraie expiration)
  requiresDate = true;
  const basis = guessedIssue || guessedExpiry;
  if (!basis) {
    return { issue: "", expiry: "", expired: null, requiresDate, hasUsableDate: false, rule: "missing_date" };
  }
  hasUsableDate = true;

  const ageDays = Math.floor((nowMs - basis.getTime()) / (1000 * 60 * 60 * 24));
  const maxAge =
    docType === "urssaf" ? 180 :
    docType === "fiscale" ? 180 :
    docType === "assurance" ? 365 : 180;

  expired = false;
  return {
    issue: toIsoLike(basis),
    expiry: "",
    expired,
    requiresDate,
    hasUsableDate,
    rule: ageDays <= maxAge ? "recent_ok" : "old_review",
    ageDays,
    reviewRecommended: ageDays > maxAge,
  };
}

// ---------------- company extraction ----------------

function extractCompanyFields(text) {
  const t = normalizeDocText(text);

  const siren = extractNumberAfterLabels(t, ["SIREN", "S I R E N"], 9) || extractFirstNumber(t, 9);
  const siret = extractNumberAfterLabels(t, ["SIRET", "S I R E T"], 14) || extractFirstNumber(t, 14);

  const rcsMatch = t.match(/RCS\s+([A-ZÀ-ÖØ-Ý\s-]+)\s*(\d{9})?/i);
  const rcs = rcsMatch ? rcsMatch[1].trim() : "";

  const denomMatch =
    t.match(/DENOMINATION\s*(SOCIALE)?[:\s]+([^\n]{5,120})/i) ||
    t.match(/RAISON\s+SOCIALE[:\s]+([^\n]{5,120})/i) ||
    t.match(/([A-Z0-9&\s'.-]{8,80})\s+SIREN/i);
  const denomination = denomMatch ? String(denomMatch[2] || denomMatch[1] || "").replace(/\s{2,}/g, " ").trim() : "";

  const adresseMatch = t.match(/(\d+\s+[^\n]{6,80}\s+\d{5}\s+[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ\s-]+)/i);
  const adresse = adresseMatch ? adresseMatch[1].trim() : "";

  return { siren, siret, rcs, denomination, adresse };
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

async function extractCompanyFieldsWithAI(text, env) {
  const prompt =
    "Tu es un extracteur d'informations. " +
    "À partir du texte d'un document d'entreprise français, retourne uniquement un JSON valide avec les clés: " +
    "siren, siret, rcs, denomination, adresse. " +
    "Si une valeur est introuvable, mets une chaîne vide. " +
    "Texte:\n" +
    text;

  const aiRes = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
    prompt,
    max_tokens: 400,
  });

  const raw = String(aiRes?.description || aiRes?.response || "").trim();
  const json = safeParseJsonFromText(raw);
  if (!json || typeof json !== "object") return {};

  return {
    siren: String(json.siren || "").replace(/\D/g, "").slice(0, 9),
    siret: String(json.siret || "").replace(/\D/g, "").slice(0, 14),
    rcs: String(json.rcs || "").trim(),
    denomination: String(json.denomination || "").trim(),
    adresse: String(json.adresse || "").trim(),
  };
}

function safeParseJsonFromText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // fallback: try to extract first JSON object in text
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
