// workers/cv-analyzer/src/index.js
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
      return jsonResponse(
        { success: false, error: "Method not allowed" },
        405,
        corsHeaders
      );
    }

    try {
      const body = await request.json();
      const fileBase64 = body?.fileBase64;

      if (!fileBase64) {
        return jsonResponse(
          { success: false, error: "fileBase64 manquant" },
          400,
          corsHeaders
        );
      }

      // Decode base64 -> Uint8Array
      const bytes = base64ToUint8Array(fileBase64);

      // 1) Extract text from PDF
      let fullText = "";
      try {
        const extractedData = await extractText(bytes, { mergePages: true });
        fullText = (extractedData?.text || "").trim();
      } catch (e) {
        fullText = "";
      }

      // 2) Regex fallback (works even if text is short/partial)
      const regexExtract = extractBasicFieldsFromText(fullText);

      // If we basically have no text, return partial info and a clear hint
      if (!fullText || fullText.length < 80) {
        return jsonResponse(
          {
            success: true,
            data: {
              nom: "",
              prenom: "",
              email: regexExtract.email || "",
              telephone: regexExtract.telephone || "",
              adresse: "",
              skills: [],
              skills_raw: ""
            },
            meta: {
              warning:
                "Texte du CV trop faible (PDF scanné / image). Seuls email/téléphone ont pu être détectés. Utilise un CV PDF avec texte sélectionnable ou un fichier mieux exporté.",
              text_length: fullText?.length || 0,
            },
          },
          200,
          corsHeaders
        );
      }

      // 3) AI extraction (more robust prompt)
      const ai = env.AI;

      const messages = [
        {
          role: "system",
          content:
            `Tu es un extracteur d'informations de CV.
Réponds UNIQUEMENT en JSON valide, sans aucun texte autour.

JSON attendu:
{
  "nom": "",
  "prenom": "",
  "email": "",
  "telephone": "",
  "adresse": "",
  "skills": []
}

Contraintes:
- Si une info est absente: ""
- "nom" = nom de famille (souvent en MAJUSCULES)
- "prenom" = prénom principal (et éventuellement prénoms)
- "email" = une seule adresse
- "telephone" = un seul numéro
- "adresse" doit inclure rue + code postal + ville si présent
- "skills" = tableau de compétences techniques/métiers (ex: ["cybersecurite","linux","python","formation"])
- Ne mets pas de commentaires, uniquement le JSON.`,
        },
        {
          role: "user",
          content:
            `Extrait les informations de ce CV.\n\n` +
            fullText.slice(0, 9000),
        },
      ];

      const modelId = "@cf/meta/llama-3.1-8b-instruct";

      const response = await ai.run(modelId, {
        messages,
        max_tokens: 600,
        temperature: 0.1,
      });

      const responseText = (response?.response || "").trim();

      // Robust JSON extraction
      const extractedInfo = safeJsonFromModelText(responseText);

      // 4) Extract skills - fallback regex + AI
      const skillsFromRegex = extractSkillsFromText(fullText);
      const skillsFromAI = Array.isArray(extractedInfo?.skills) 
        ? extractedInfo.skills.map(s => normalizeSkill(s))
        : [];

      // Merge skills (priorité AI, puis regex)
      const allSkills = [...new Set([...skillsFromAI, ...skillsFromRegex])];

      // Clean + merge with regex fallback (never lose email/tel)
      const cleanData = {
        nom: cleanStr(extractedInfo?.nom),
        prenom: cleanStr(extractedInfo?.prenom),
        email: cleanEmail(extractedInfo?.email) || regexExtract.email || "",
        telephone:
          cleanPhone(extractedInfo?.telephone) ||
          regexExtract.telephone ||
          "",
        adresse: cleanStr(extractedInfo?.adresse),
        skills: allSkills.slice(0, 20), // max 20 compétences
        skills_raw: allSkills.join(", ")
      };

      return jsonResponse(
        {
          success: true,
          data: cleanData,
          meta: {
            text_length: fullText.length,
            model: modelId,
            skills_found: allSkills.length
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
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function cleanStr(v) {
  return (typeof v === "string" ? v : "").trim();
}

function cleanEmail(v) {
  const s = cleanStr(v).toLowerCase();
  if (!s) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "";
  return s;
}

function cleanPhone(v) {
  const s = cleanStr(v);
  if (!s) return "";
  const normalized = s.replace(/[^\d+]/g, " ").replace(/\s+/g, " ").trim();
  const digits = normalized.replace(/[^\d]/g, "");
  if (digits.length < 8) return "";
  return normalized;
}

function extractBasicFieldsFromText(text) {
  const t = (text || "").replace(/\s+/g, " ");

  const emailMatch = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0] : "";

  const phoneMatch = t.match(
    /(\+?\d{1,3}[\s.-]?)?(\(?\d{1,4}\)?[\s.-]?)?(\d[\s.-]?){7,}\d/g
  );
  const telephone = phoneMatch ? phoneMatch[0] : "";

  return { email, telephone };
}

// ✅ NOUVELLE FONCTION: Extraction de compétences par regex
function extractSkillsFromText(text) {
  const skillKeywords = [
    // Cybersécurité
    "cybersecurite", "cybersécurité", "securite", "sécurité", "pentest", "ethical hacking",
    "soc", "siem", "firewall", "ids", "ips", "vulnerability", "iso27001",
    
    // Systèmes
    "linux", "unix", "windows server", "active directory", "vmware", "docker", "kubernetes",
    
    // Réseaux
    "reseau", "réseau", "cisco", "juniper", "tcp/ip", "vpn", "lan", "wan", "vlan",
    
    // Programmation
    "python", "java", "javascript", "c++", "php", "ruby", "go", "rust",
    "react", "angular", "vue", "node.js", "django", "flask",
    
    // Data
    "sql", "mysql", "postgresql", "mongodb", "nosql", "big data", "hadoop", "spark",
    
    // Cloud
    "aws", "azure", "gcp", "cloud computing", "devops", "terraform", "ansible",
    
    // Formation
    "formation", "formateur", "pedagogie", "pédagogie", "enseignement", "coaching",
    
    // Gestion projet
    "agile", "scrum", "kanban", "jira", "confluence", "git", "gitlab", "github"
  ];

  const found = [];
  const textLower = text.toLowerCase();

  for (const skill of skillKeywords) {
    if (textLower.includes(skill.toLowerCase())) {
      found.push(normalizeSkill(skill));
    }
  }

  return [...new Set(found)]; // dédupliquer
}

function normalizeSkill(skill) {
  return skill
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9+#.\s-]/g, "")
    .trim();
}

function safeJsonFromModelText(text) {
  // Try direct JSON parse first
  try {
    const direct = JSON.parse(text);
    return direct && typeof direct === "object" ? direct : {};
  } catch {}

  // Then extract the first {...} block (greedy between first { and last })
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