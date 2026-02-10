// pages/api/generate-contract.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
      date_signature: variables?.date_signature || new Date().toISOString().split("T")[0],
      lieu_signature: variables?.lieu_signature || "Vélizy-Villacoublay",
      taux_journalier: variables?.taux_journalier || "25",
      duree_mission: variables?.duree_mission || "",
      date_debut: variables?.date_debut || "01/10/2025",
      date_fin: variables?.date_fin || "31/08/2026",
      signature_data_url: variables?.signature_data_url || "",
      signature_confirmed: variables?.signature_confirmed || false,
    };

    const pdfBytes = await generateContractPdf(contractData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Contrat_${prestataire.nom || "Prestataire"}_${employer.denomination || "Employeur"}.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Erreur génération contrat:", error);
    return res.status(500).json({
      error: error.message,
      details: "Impossible de générer le contrat",
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function generateContractPdf(data) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4

  const fontBody = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBodyBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontHeading = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontUI = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margin = 46;
  const lineHeight = 16;

  const c = {
    ink: rgb(0.07, 0.08, 0.1),
    muted: rgb(0.4, 0.42, 0.45),
    line: rgb(0.85, 0.86, 0.88),
    soft: rgb(0.97, 0.97, 0.98),
  };

  let { width, height } = page.getSize();
  let cursorY = height - margin;

  const sanitizePdfText = (input) => {
    return String(input || "")
      .replace(/\?/g, "")
      .replace(/[•●]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-");
  };

const wrapText = (text, usedFont, size, maxW) => {
    const safeText = sanitizePdfText(text);
    const words = String(safeText || "").split(/\s+/).filter(Boolean);
    const lines = [];

    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const w = usedFont.widthOfTextAtSize(testLine, size);
      if (w <= maxW) line = testLine;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const fixMojibake = (s) => {
    const str = String(s || "");
    if (/[ÂÃâ]/.test(str)) {
      try {
        return Buffer.from(str, "latin1").toString("utf8");
      } catch {
        return str;
      }
    }
    return str;
  };

  const newPage = () => {
    page = pdfDoc.addPage([595.28, 841.89]);
    ({ width, height } = page.getSize());
    cursorY = height - margin;
  };

  const ensureSpace = (needed) => {
    if (cursorY - needed < margin) newPage();
  };

  const drawTextLines = (lines, size, usedFont) => {
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y: cursorY, size, font: usedFont, color: c.ink });
      cursorY -= lineHeight;
    }
  };

  const drawCenteredTitle = (text) => {
    const size = 18;
    const lines = wrapText(text, fontHeading, size, width - margin * 2);
    for (const line of lines) {
      const lineW = fontHeading.widthOfTextAtSize(line, size);
      const x = (width - lineW) / 2;
      ensureSpace(lineHeight + 6);
      page.drawText(line, { x, y: cursorY, size, font: fontHeading, color: c.ink });
      cursorY -= lineHeight + 2;
    }
    cursorY -= 8;
    page.drawRectangle({ x: margin, y: cursorY, width: width - margin * 2, height: 1, color: c.line });
    cursorY -= 16;
  };

  const drawSectionTitle = (text) => {
    ensureSpace(24);
    page.drawText(text.toUpperCase(), { x: margin, y: cursorY, size: 11, font: fontHeading, color: c.ink });
    page.drawRectangle({ x: margin, y: cursorY - 4, width: width - margin * 2, height: 1, color: c.line });
    cursorY -= 16;
  };  const drawInfoBlock = (title, items) => {
    ensureSpace(96);
    const boxW = (width - margin * 2 - 16) / 2;
    const boxH = 92;
    const x = title === "L'EMPLOYEUR" ? margin : margin + boxW + 16;
    const y = cursorY - boxH;
    page.drawRectangle({
      x,
      y,
      width: boxW,
      height: boxH,
      borderColor: c.line,
      borderWidth: 1,
      color: c.soft,
    });
    page.drawText(title, { x: x + 10, y: cursorY - 16, size: 10, font: fontHeading, color: c.ink });
    let ty = cursorY - 32;
    for (const [label, value] of items) {
      if (ty < y + 10) break;
      const line = `${label} ${value || "-"}`;
      page.drawText(line, { x: x + 10, y: ty, size: 9.5, font: fontBody, color: c.ink });
      ty -= 12;
    }
  };



  const drawParagraph = (text) => {
    if (!text || !String(text).trim()) {
      cursorY -= 8;
      return;
    }
    const lines = wrapText(text, fontBody, 11, width - margin * 2);
    drawTextLines(lines, 11, fontBody);
    cursorY -= 8;
  };

  const drawBullet = (text) => {
    const bullet = "•";
    const textIndent = 18;
    const lines = wrapText(text, fontBody, 11, width - margin * 2 - textIndent);
    if (!lines.length) return;
    ensureSpace(lineHeight);
    page.drawText(bullet, { x: margin, y: cursorY, size: 11, font: fontBodyBold, color: c.ink });
    page.drawText(lines[0], { x: margin + textIndent, y: cursorY, size: 11, font: fontBody, color: c.ink });
    cursorY -= lineHeight;
    for (let i = 1; i < lines.length; i++) {
      ensureSpace(lineHeight);
      page.drawText(lines[i], { x: margin + textIndent, y: cursorY, size: 11, font: fontBody, color: c.ink });
      cursorY -= lineHeight;
    }
    cursorY -= 2;
  };

  // Logo (optionnel)
  let logoImage = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "Logo_caplogy_contrat.png");
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    }
  } catch (err) {
    console.warn("Logo non chargé:", err.message);
  }

  if (logoImage) {
    const maxW = 120;
    const maxH = 40;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, { x: width - margin - w, y: height - margin - h + 6, width: w, height: h });
  }

  drawCenteredTitle("Contrat de prestation de service");

  // Extraction du RCS depuis la ville (ex: "MELUN" depuis l'adresse)
  const extraireVilleRCS = (adresse) => {
    if (!adresse) return "Melun";
    const match = adresse.match(/\d{5}\s+([A-Z\s-]+)/i);
    return match ? match[1].trim() : "Melun";
  };

  const tokens = {
    PRESTA_DENOMINATION: data.prestataire_denomination || "___________",
    PRESTA_SIREN: data.prestataire_siren || "___________",
    PRESTA_SIRET: data.prestataire_siret || "___________",
    PRESTA_ADRESSE: data.prestataire_adresse || "___________",
    PRESTA_REPRESENTANT: `${data.prestataire_prenom || ""} ${data.prestataire_nom || ""}`.trim() || data.prestataire_representant || "___________",
    PRESTA_FONCTION: data.prestataire_fonction || "représentant de la personne morale",
    PRESTA_RCS: extraireVilleRCS(data.prestataire_adresse),
    DATE_DEBUT: data.date_debut || "01/10/2025",
    DATE_FIN: data.date_fin || "31/08/2026",
    TAUX_HORAIRE: data.taux_journalier || "25",
    EMPLOYER_ADRESSE: data.employer_adresse || "36 Avenue de l'Europe, 78140 Vélizy-Villacoublay",
    EMPLOYER_SIREN: data.employer_siren || "893 395 608",
    EMPLOYER_RCS: data.employer_rcs || "VERSAILLES",
  };

  const applyTokens = (line) => {
    return String(line || "")
      .replace(/{{PRESTA_DENOMINATION}}/g, tokens.PRESTA_DENOMINATION)
      .replace(/{{PRESTA_SIREN}}/g, tokens.PRESTA_SIREN)
      .replace(/{{PRESTA_SIRET}}/g, tokens.PRESTA_SIRET)
      .replace(/{{PRESTA_ADRESSE}}/g, tokens.PRESTA_ADRESSE)
      .replace(/{{PRESTA_REPRESENTANT}}/g, tokens.PRESTA_REPRESENTANT)
      .replace(/{{PRESTA_FONCTION}}/g, tokens.PRESTA_FONCTION)
      .replace(/{{PRESTA_RCS}}/g, tokens.PRESTA_RCS)
      .replace(/{{DATE_DEBUT}}/g, tokens.DATE_DEBUT)
      .replace(/{{DATE_FIN}}/g, tokens.DATE_FIN)
      .replace(/{{TAUX_HORAIRE}}/g, tokens.TAUX_HORAIRE)
      .replace(/{{EMPLOYER_ADRESSE}}/g, tokens.EMPLOYER_ADRESSE)
      .replace(/{{EMPLOYER_SIREN}}/g, tokens.EMPLOYER_SIREN)
      .replace(/{{EMPLOYER_RCS}}/g, tokens.EMPLOYER_RCS);
  };

  const lines = [
    "Entre les soussign?s :",
    "",
    "Entre la société Caplogy Services, SAS au capital de 2 000 euros, RCS Pontoise N° SIREN 979847522 APE 6202A, dont le siège social est situé au 4 Avenue des Aubépines, 95500 Gonesse, représentée aux fins des présentes par Monsieur Arezki ABERKANE, agissant en qualité de représentant de la personne morale.",
    "Ci-après dénommée « la société »",
    "ET :",
    "",
    "{{PRESTA_DENOMINATION}}, immatriculée au RCS de {{PRESTA_RCS}} sous le N° SIREN {{PRESTA_SIREN}}, dont le siège social est {{PRESTA_ADRESSE}}, représentée par {{PRESTA_REPRESENTANT}}, agissant en qualité de {{PRESTA_FONCTION}}.",
    "Ci-après dénommé « le prestataire formateur »,",
    "Article 1 : Objet",
    "● Le contrat a pour objet d'une ou plusieurs prestations suivantes : prestations de formation et d'enseignement.",
    "● Le prestataire formateur a pour activité l'enseignement et la formation dans des centres de formations ou des entreprises.",
    "● La société fait appel aux services du prestataire formateur pour assurer les prestations d'enseignement et de formation.",
    "Article 2 : Durée",
    "● Le présent contrat est conclu pour une durée déterminée auto-entrepreneur du {{DATE_DEBUT}} et se termine au plus tard le {{DATE_FIN}}",
    "● Il n'est fixé aucun minimum d'interventions. Le prestataire formateur ne pourra prétendre à aucun dédommagement si le nombre d'interventions lui semble insuffisant sur cette période.",
    "Article 3 : Rupture du contrat",
    "● Ce contrat ne peut être rompu par le prestataire avant l'accomplissement de toutes les prestations déjà convenues avec la société.",
    "● Toutes volontés de rupture du contrat avant l'accomplissement des prestations déjà établies entre le prestataire et la société entraînera le non-paiement de toutes les prestations déjà accomplies.",
    "Article 4: Modalités d'exécution",
    "Le présent contrat est conclu dans le cadre d'une prestation particulière conclue par la société pour assurer le suivi scolaire des étudiants. Ladite prestation doit être réalisée conformément dans le cadre proposé par les fiches de cours mises à disposition du prestataire et les référentiels pédagogiques (compétences et connaissances).",
    "Article 4-1 : Mise à disposition d'outils pédagogiques",
    "En amont de ses interventions, et dans un calendrier défini par la société, le prestataire formateur s'engage à fournir :",
    "Des sources littéraires et numériques, que les apprenants pourront consulter pour « aller plus loin » dans leur apprentissage et formation.",
    "Durant sa période d'intervention, le prestataire formateur devra alimenter la plateforme pédagogique de ressources documentaires à l'attention des apprenants.",
    "Un accès personnel et un tutoriel seront fournis au prestataire formateur afin de favoriser son utilisation.",
    "Article 4-2 : Conditions d'assiduité des apprenants",
    "Dans le cadre d'une démarche qualité des interventions, le suivi de présence des apprenants est sous la responsabilité du prestataire formateur.",
    "Les outils nécessaires et indispensables seront fournis pour chaque séance.",
    "Le prestataire formateur sera garant de l'assiduité globale des apprenants sur l'ensemble des interventions",
    "Le prestataire formateur pourra ainsi mettre un apprenant dans une situation de non-validation de la matière, au-delà d'un quota minimum d'absence.",
    "Article 5 : Lieu d'exécution",
    "Le déroulement des cours auront lieu dans différents établissements (selon le planning fourni par la société)",
    "Au sein des locaux du client, le prestataire s'engage à se conformer aux règlements, directives et recommandations relatifs aux règlements intérieurs de l'établissement d'enseignement.",
    "Article 6 : Coût de la prestation",
    "● Le coût horaire de la prestation a été fixé entre les deux parties à {{TAUX_HORAIRE}} € / Heure TTC. Toutefois, ce tarif pourra être ajusté en fonction des exigences spécifiques et des besoins qui pourraient survenir au cours de la collaboration, le prestataire sera informé de tout changement du coût horaire.",
    "● Il est précisé que le montant payé sera calculé précisément sur la base du nombre d'heures effectuées par le prestataire formateur. La société paiera au prestataire formateur un montant égal au coût horaire multiplié par le nombre d'heures effectuées.",
    "● Il n'est prévu aucun minimum de facturation.",
    "● Le prestataire ne sera pas remboursé de ses frais dans le cadre de ce contrat.",
    "Article 7 : Facturation de la prestation",
    "● Le prestataire formateur facturera mensuellement la société selon un calendrier défini par la société. Il ne pourra facturer que les prestations dûment effectuées. Le paiement de l'ensemble d'heures de formation ne sera effectué qu'une fois reçu l'ensemble des notes et appréciations correspondant aux évaluations réalisées par les étudiants dans le cadre du cours.",
    "● En cas d'annulation d'une séance de cours moins de deux jours ouvrés avant une séance, et dans la mesure où cette annulation a causé un préjudice pour les clients de la société ainsi que son image, la société se réserve le droit de déduire du montant de la facture du prestataire l'équivalent d'une journée de facturation.",
    "● Une fois que la prestation est accomplie, le prestataire est dans l'obligation de la valider sur son espace personnel « My CAPLOGY ».",
    "● La facture mensuelle devra être obligatoirement jointe sur votre espace personnel « My CAPLOGY ».",
    "● La facture mensuelle devra être envoyée au plus tard le 10 du mois suivant, afin d'être contrôlée et mise au règlement pour un paiement.",
    "● Au-delà du 10 du mois suivant, le traitement de ladite facture sera reporté au mois d'après.",
    "● Les factures seront réglées dans un délai de 30 jours fin du mois à compter de leurs date de réception.",
    "La facture devra comporter les informations minimales suivantes :",
    "● Nom du formateur",
    "● Date(s) intervention(s)",
    "● Classe(s) concernée(s)",
    "● Nombre de jours effectués en présentiel",
    "● Nombre de jours effectués en télétravail",
    "● Le montant total de la facture",
    "Sans l'ensemble de ces informations, la facture ne pourra pas être traitée, elle fera objet d'une demande de complément d'informations, ce qui pourra engendrer un délai supplémentaire pour le traitement.",
    "Article 8 : Réalisation des prestations",
    "Le prestataire formateur organise et exécute ses missions en toute indépendance et selon ses propres méthodes pédagogiques. Néanmoins, il est dans l'obligation de suivre le plan de travail fourni par la société.",
    "Le prestataire doit joindre dans son espace personnel « My CAPLOGY » tous les supports de cours, annexes et travaux réalisés dans ses interventions.",
    "Le prestataire gère ses disponibilités en toute indépendance. Il reste libre d'accepter ou de refuser une prestation. Néanmoins, une fois la prestation acceptée et validée, il est dans l'obligation de l'accomplir.",
    "Article 9 : Non concurrence",
    "Le prestataire formateur s'interdit de proposer ses services directement aux clients présentés par la société. Ceci pendant toute la durée de l'exécution du présent contrat et pendant les 18 (dix-huit) mois qui suivent la cessation des relations contractuelles. S'il devait cependant contrevenir à son obligation de non-concurrence, il devra verser à la société une indemnité de 15000 € sans préjudice de toute action de celle-ci devant les juridictions compétentes.",
    "Article 10 : Confidentialité",
    "L'intégralité des documents et contenus envoyés par la société au prestataire formateur sous quelque format que ce soit sont strictement confidentiels et réservés à l'usage exclusif dudit prestataire pour la préparation de ses interventions.",
    "Article 11 : Restitution des biens",
    "A l'expiration ou à la résiliation du contrat, le prestataire doit restituer tous les biens, les documents, les dossiers, les informations confidentielles, les notes et résultats des élevés et la propriété intellectuelle appartenant aux clients et la société.",
  ];

  for (const raw of lines) {
    const line = fixMojibake(applyTokens(raw));
    const lineTrim = line.trimStart();
    if (!lineTrim) {
      drawParagraph("");
      continue;
    }
    if (lineTrim.startsWith("Entre les soussign?s")) {
      drawSectionTitle(lineTrim);
      continue;
    }
    if (lineTrim.startsWith("Article")) {
      drawSectionTitle(lineTrim);
      continue;
    }
    if (lineTrim.startsWith("?") || lineTrim.startsWith("?")) {
      drawBullet(lineTrim.replace(/^(?:•|●)\s?/, ""));
      continue;
    }
    drawParagraph(sanitizePdfText(line));
  }

  drawParagraph(`Fait à ${data.lieu_signature || "Vélizy-Villacoublay"}, le ${data.date_signature || "01/10/2025"}`);

  const signBoxW = (width - margin * 2 - 12) / 2;
  const signBoxH = 84;
  ensureSpace(signBoxH + 32);

  // Signature boxes
  page.drawRectangle({ x: margin, y: cursorY - signBoxH, width: signBoxW, height: signBoxH, borderColor: c.line, borderWidth: 1, color: c.soft });
  page.drawRectangle({ x: margin + signBoxW + 12, y: cursorY - signBoxH, width: signBoxW, height: signBoxH, borderColor: c.line, borderWidth: 1, color: c.soft });

  page.drawText("Pour le prestataire", { x: margin + 10, y: cursorY - 18, size: 10, font: fontUI, color: c.muted });
  page.drawText("Signature", { x: margin + 10, y: cursorY - 32, size: 9, font: fontUI, color: c.muted });

  page.drawText("Pour l?entreprise", { x: margin + signBoxW + 22, y: cursorY - 18, size: 10, font: fontUI, color: c.muted });
  page.drawText("Pr?c?der avec la mention ? lu et approuv? ?", { x: margin + signBoxW + 22, y: cursorY - 32, size: 8.5, font: fontUI, color: c.muted });

  let signatureImage = null;
  if (data.signature_data_url) {
    try {
      const b64 = data.signature_data_url.split(",").pop();
      const bytes = Buffer.from(b64, "base64");
      signatureImage = await pdfDoc.embedPng(bytes);
    } catch {
      signatureImage = null;
    }
  }
  if (signatureImage) {
    const padX = 12;
    const padY = 16;
    const maxW = signBoxW - padX * 2;
    const maxH = signBoxH - 40;
    const scale = Math.min(maxW / signatureImage.width, maxH / signatureImage.height);
    const w = signatureImage.width * scale;
    const h = signatureImage.height * scale;
    const x = margin + padX + (maxW - w) / 2;
    const y = cursorY - signBoxH + padY + (maxH - h) / 2;
    page.drawImage(signatureImage, { x, y, width: w, height: h });
  }

  cursorY -= signBoxH + 22;

  drawParagraph(`CAPLOGY SAS - Siège social : ${tokens.EMPLOYER_ADRESSE} N° SIREN : ${tokens.EMPLOYER_SIREN} - RCS ${tokens.EMPLOYER_RCS}`);

  return await pdfDoc.save();
}