// pages/api/extract-contract-fields.js
import pdf from "pdf-parse";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { documents, nom, prenom } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: "documents[] requis" });
    }

    if (!nom || !prenom) {
      return res.status(400).json({ error: "nom et prenom requis" });
    }

    // Extraire texte de tous les documents
    let allText = "";

    for (const doc of documents) {
      if (!doc.fileBase64 || !doc.type) continue;

      try {
        const buffer = Buffer.from(doc.fileBase64, "base64");
        const data = await pdf(buffer);
        const text = data.text || "";
        
        allText += `\n--- ${doc.type} ---\n${text}\n`;
      } catch (e) {
        console.warn(`Impossible d'extraire ${doc.type}:`, e.message);
      }
    }

    // Extraction via regex + patterns
    const extracted = extractPrestataireFields(allText, nom, prenom);

    return res.status(200).json({ 
      prestataire: extracted 
    });

  } catch (error) {
    console.error("Erreur extraction contrat:", error);
    return res.status(500).json({ 
      error: error.message 
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
  const sirenMatch = text.match(/SIREN[:\s]+(\d{9})/i) || 
                     text.match(/\b(\d{9})\b/);
  if (sirenMatch) prestataire.siren = sirenMatch[1];

  // SIRET (14 chiffres)
  const siretMatch = text.match(/SIRET[:\s]+(\d{14})/i) ||
                     text.match(/\b(\d{14})\b/);
  if (siretMatch) prestataire.siret = siretMatch[1];

  // RCS
  const rcsMatch = text.match(/RCS\s+([A-Z\s]+\d+[A-Z\s]*)/i);
  if (rcsMatch) prestataire.rcs = rcsMatch[1].trim();

  // Dénomination sociale (entreprise individuelle ou société)
  const denomMatch = text.match(/DENOMINATION[:\s]+([^\n]{5,100})/i) ||
                     text.match(/RAISON SOCIALE[:\s]+([^\n]{5,100})/i) ||
                     text.match(/([A-Z][A-Z\s&]{10,80})\s+SIREN/i);
  if (denomMatch) {
    prestataire.denomination = denomMatch[1]
      .replace(/SIREN.*$/i, "")
      .trim();
  }

  // Adresse (pattern français)
  const adresseMatch = text.match(/(\d+[\s,]+[^\n]{10,100}[\s,]+\d{5}[\s,]+[A-Z][a-zéèêà]+)/i);
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

  // Fonction représentant
  const fonctionMatch = text.match(/(Gérant|Président|Directeur)/i);
  if (fonctionMatch) {
    prestataire.fonction_representant = fonctionMatch[1];
  }

  return prestataire;
}