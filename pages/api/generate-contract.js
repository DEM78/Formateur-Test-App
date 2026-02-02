// pages/api/generate-contract.js
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { employer, prestataire, variables } = req.body;

    if (!employer || !prestataire) {
      return res.status(400).json({ error: "employer et prestataire requis" });
    }

    // Charger le template ODT
    const templatePath = path.join(process.cwd(), "public", "templates", "contrat-prestation-template.odt");
    
    let content;
    try {
      content = fs.readFileSync(templatePath, "binary");
    } catch (e) {
      // Fallback: générer un template basique si fichier absent
      return generateBasicContract(res, employer, prestataire, variables);
    }

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Préparer les données pour le template
    const contractData = {
      // Employeur
      employer_denomination: employer.denomination || "",
      employer_siren: employer.siren || "",
      employer_siret: employer.siret || "",
      employer_adresse: employer.adresse || "",
      employer_forme_juridique: employer.forme_juridique || "",
      employer_capital: employer.capital || "",
      employer_rcs: employer.rcs || "",
      employer_representant: employer.representant || "",
      employer_fonction: employer.fonction_representant || "",

      // Prestataire
      prestataire_nom: prestataire.nom || "",
      prestataire_prenom: prestataire.prenom || "",
      prestataire_denomination: prestataire.denomination || "",
      prestataire_siren: prestataire.siren || "",
      prestataire_siret: prestataire.siret || "",
      prestataire_rcs: prestataire.rcs || "",
      prestataire_adresse: prestataire.adresse || "",
      prestataire_representant: prestataire.representant || "",
      prestataire_fonction: prestataire.fonction_representant || "",

      // Variables
      date_signature: variables?.date_signature || new Date().toLocaleDateString("fr-FR"),
      lieu_signature: variables?.lieu_signature || "Paris",
      taux_journalier: variables?.taux_journalier || "",
      duree_mission: variables?.duree_mission || "",
      date_debut: variables?.date_debut || "",
      date_fin: variables?.date_fin || "",
    };

    doc.render(contractData);

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    res.setHeader("Content-Type", "application/vnd.oasis.opendocument.text");
    res.setHeader("Content-Disposition", `attachment; filename="Contrat_${prestataire.nom}_${employer.denomination}.odt"`);
    res.send(buf);

  } catch (error) {
    console.error("Erreur génération contrat:", error);
    return res.status(500).json({ 
      error: error.message,
      details: "Impossible de générer le contrat"
    });
  }
}

// Fallback: génération HTML basique si template ODT absent
function generateBasicContract(res, employer, prestataire, variables) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat de Prestation</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    h1 { text-align: center; color: #111; }
    h2 { color: #333; margin-top: 30px; }
    .section { margin: 20px 0; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; }
  </style>
</head>
<body>
  <h1>CONTRAT DE PRESTATION DE SERVICES</h1>
  
  <h2>Entre les soussignés :</h2>
  
  <div class="section">
    <h3>L'EMPLOYEUR :</h3>
    <div class="field"><span class="label">Dénomination :</span> ${employer.denomination || ""}</div>
    <div class="field"><span class="label">SIREN :</span> ${employer.siren || ""}</div>
    <div class="field"><span class="label">Adresse :</span> ${employer.adresse || ""}</div>
    <div class="field"><span class="label">Forme juridique :</span> ${employer.forme_juridique || ""}</div>
    <div class="field"><span class="label">Représentée par :</span> ${employer.representant || ""}, ${employer.fonction_representant || ""}</div>
  </div>
  
  <div class="section">
    <h3>LE PRESTATAIRE :</h3>
    <div class="field"><span class="label">Nom :</span> ${prestataire.nom || ""} ${prestataire.prenom || ""}</div>
    <div class="field"><span class="label">Dénomination :</span> ${prestataire.denomination || ""}</div>
    <div class="field"><span class="label">SIREN :</span> ${prestataire.siren || ""}</div>
    <div class="field"><span class="label">SIRET :</span> ${prestataire.siret || ""}</div>
    <div class="field"><span class="label">Adresse :</span> ${prestataire.adresse || ""}</div>
    <div class="field"><span class="label">Représenté par :</span> ${prestataire.representant || ""}</div>
  </div>

  <h2>Article 1 - Objet du contrat</h2>
  <p>Le présent contrat a pour objet la réalisation de prestations de formation professionnelle.</p>

  <h2>Article 2 - Durée et modalités</h2>
  <div class="field"><span class="label">Date de début :</span> ${variables?.date_debut || "À définir"}</div>
  <div class="field"><span class="label">Date de fin :</span> ${variables?.date_fin || "À définir"}</div>
  <div class="field"><span class="label">Taux journalier :</span> ${variables?.taux_journalier || "À définir"} €</div>

  <h2>Article 3 - Conditions de paiement</h2>
  <p>Le paiement sera effectué sur présentation de facture, dans un délai de 30 jours.</p>

  <div class="section" style="margin-top: 60px;">
    <p>Fait à ${variables?.lieu_signature || "Paris"}, le ${variables?.date_signature || new Date().toLocaleDateString("fr-FR")}</p>
    <div style="display: flex; justify-content: space-between; margin-top: 60px;">
      <div>
        <p><strong>L'Employeur</strong></p>
        <p>Signature :</p>
      </div>
      <div>
        <p><strong>Le Prestataire</strong></p>
        <p>Signature :</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Contrat_${prestataire.nom}_${employer.denomination}.html"`);
  res.send(html);
}