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
      prestataire_email: prestataire.email || prestataire.mail || "",
      prestataire_telephone: prestataire.telephone || prestataire.phone || "",
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
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const margin = 50;
  const lineHeight = 15;

  // Palette de couleurs professionnelle (nuances de bleu uniquement)
  const c = {
    primary: rgb(0.09, 0.28, 0.51),      // Bleu foncé professionnel
    secondary: rgb(0.2, 0.45, 0.72),     // Bleu moyen
    accent: rgb(0.35, 0.55, 0.75),       // Bleu clair pour accents
    ink: rgb(0.15, 0.15, 0.18),          // Texte principal
    muted: rgb(0.45, 0.47, 0.50),        // Texte secondaire
    line: rgb(0.82, 0.84, 0.86),         // Lignes légères
    lightBg: rgb(0.96, 0.97, 0.98),      // Fond clair
    white: rgb(1, 1, 1),                 // Blanc pur
  };

  let { width, height } = page.getSize();
  let cursorY = height - margin;

  const sanitizePdfText = (input) => {
    return String(input || "")
      .replace(/\?/g, "")
      .replace(/[•●]/g, "-")
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
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
    if (cursorY - needed < margin + 20) newPage();
  };

  const drawTextLines = (lines, size, usedFont, color = c.ink) => {
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y: cursorY, size, font: usedFont, color });
      cursorY -= lineHeight;
    }
  };

  const drawTextLinesJustified = (lines, size, usedFont, maxW) => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      ensureSpace(lineHeight);

      const words = String(line || "").split(/\s+/).filter(Boolean);
      const isLastLine = i === lines.length - 1;

      if (isLastLine || words.length <= 1) {
        page.drawText(line, { x: margin, y: cursorY, size, font: usedFont, color: c.ink });
        cursorY -= lineHeight;
        continue;
      }

      const spaceW = usedFont.widthOfTextAtSize(" ", size);
      const wordsW = words.reduce((acc, w) => acc + usedFont.widthOfTextAtSize(w, size), 0);
      const gaps = words.length - 1;
      const totalDefaultSpacesW = gaps * spaceW;
      const extra = Math.max(0, maxW - (wordsW + totalDefaultSpacesW));
      const extraPerGap = extra / gaps;

      let x = margin;
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        page.drawText(w, { x, y: cursorY, size, font: usedFont, color: c.ink });
        x += usedFont.widthOfTextAtSize(w, size);
        if (wi < gaps) x += spaceW + extraPerGap;
      }
      cursorY -= lineHeight;
    }
  };

  // En-tête avec bande colorée
  const drawHeader = () => {
    // Bande bleue en haut
    page.drawRectangle({
      x: 0,
      y: height - 10,
      width: width,
      height: 10,
      color: c.primary,
    });
  };

  // Logo centré
  const drawCenteredLogo = (logoImage) => {
    if (!logoImage) return;
    
    const maxW = 180;
    const maxH = 60;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    const x = (width - w) / 2;
    
    page.drawImage(logoImage, { 
      x, 
      y: cursorY - h, 
      width: w, 
      height: h 
    });
    
    cursorY -= h + 20;
  };

  // Titre principal centré avec design moderne
  const drawMainTitle = (text) => {
    const size = 22;
    ensureSpace(60);
    
    const textWidth = fontHeading.widthOfTextAtSize(text, size);
    const x = (width - textWidth) / 2;
    
    // Texte principal
    page.drawText(text.toUpperCase(), { 
      x, 
      y: cursorY, 
      size, 
      font: fontHeading, 
      color: c.primary 
    });
    
    cursorY -= 12;
    
    // Ligne décorative dorée sous le titre
    const lineW = textWidth + 40;
    const lineX = (width - lineW) / 2;
    page.drawRectangle({
      x: lineX,
      y: cursorY - 2,
      width: lineW,
      height: 3,
      color: c.accent,
    });
    
    cursorY -= 35;
  };

  // Section "Entre les soussignés" avec design élégant
  const drawPartiesHeader = () => {
    ensureSpace(40);
    
    const text = "ENTRE LES SOUSSIGNÉS";
    const size = 13;
    const textWidth = fontHeading.widthOfTextAtSize(text, size);
    const x = (width - textWidth) / 2;
    
    // Rectangle de fond
    page.drawRectangle({
      x: margin - 10,
      y: cursorY - 25,
      width: width - (margin - 10) * 2,
      height: 32,
      color: c.lightBg,
      borderColor: c.line,
      borderWidth: 1,
    });
    
    page.drawText(text, {
      x,
      y: cursorY - 8,
      size,
      font: fontHeading,
      color: c.primary,
    });
    
    cursorY -= 40;
  };

  // Bloc partie contractante avec design amélioré
  const drawPartyBlock = (title, items, isLeft = true) => {
    const rows = Math.ceil(items.length / 2);
    const rowHeight = 24;
    const boxH = Math.max(120, 44 + rows * rowHeight + 8);
    ensureSpace(boxH + 20);
    
    const boxW = width - margin * 2;
    const x = margin;
    const y = cursorY - boxH;
    
    // Fond avec bordure
    page.drawRectangle({
      x,
      y,
      width: boxW,
      height: boxH,
      color: c.white,
      borderColor: c.secondary,
      borderWidth: 1.5,
    });
    
    // Bande de titre colorée
    page.drawRectangle({
      x,
      y: y + boxH - 28,
      width: boxW,
      height: 28,
      color: c.primary,
    });
    
    // Petit accent doré
    page.drawRectangle({
      x,
      y: y + boxH - 30,
      width: 4,
      height: 30,
      color: c.accent,
    });
    
    // Titre en blanc
    page.drawText(title, { 
      x: x + 15, 
      y: y + boxH - 19, 
      size: 11, 
      font: fontHeading, 
      color: c.white 
    });
    
    // Contenu en 2 colonnes pour reduire la hauteur du bloc
    const contentTop = y + boxH - 43;
    const colGap = 16;
    const colW = (boxW - 30 - colGap) / 2;
    const leftX = x + 15;
    const rightX = leftX + colW + colGap;

    for (let i = 0; i < items.length; i++) {
      const [label, value] = items[i];
      const row = Math.floor(i / 2);
      const isRight = i % 2 === 1;
      const colX = isRight ? rightX : leftX;
      const ty = contentTop - row * rowHeight;
      if (ty < y + 10) break;

      const raw = `${label}: ${value || "-"}`;
      const line = wrapText(raw, fontBody, 9.2, colW)[0];
      page.drawText(line, {
        x: colX,
        y: ty - 10,
        size: 9.2,
        font: fontBody,
        color: c.ink,
      });
    }
    
    cursorY -= boxH + 20;
  };

  // Titre de section avec style moderne
  const drawSectionTitle = (text) => {
    ensureSpace(35);
    
    // Rectangle de fond
    page.drawRectangle({
      x: margin - 5,
      y: cursorY - 22,
      width: width - (margin - 5) * 2,
      height: 26,
      color: c.lightBg,
    });
    
    // Accent coloré à gauche
    page.drawRectangle({
      x: margin - 5,
      y: cursorY - 22,
      width: 4,
      height: 26,
      color: c.primary,
    });
    
    page.drawText(text.toUpperCase(), { 
      x: margin + 8, 
      y: cursorY - 8, 
      size: 11, 
      font: fontHeading, 
      color: c.primary 
    });
    
    cursorY -= 32;
  };

  const drawParagraph = (text) => {
    if (!text || !String(text).trim()) {
      cursorY -= 6;
      return;
    }
    const maxW = width - margin * 2;
    const lines = wrapText(text, fontBody, 10.5, maxW);
    
    // Utiliser la justification complète pour tous les paragraphes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      ensureSpace(lineHeight);

      const words = String(line || "").split(/\s+/).filter(Boolean);
      const isLastLine = i === lines.length - 1;

      // Dernière ligne : alignée à gauche seulement
      if (isLastLine || words.length <= 1) {
        page.drawText(line, { x: margin, y: cursorY, size: 10.5, font: fontBody, color: c.ink });
        cursorY -= lineHeight;
        continue;
      }

      // Justification complète : distribuer l'espace entre les mots
      const spaceW = fontBody.widthOfTextAtSize(" ", 10.5);
      const wordsW = words.reduce((acc, w) => acc + fontBody.widthOfTextAtSize(w, 10.5), 0);
      const gaps = words.length - 1;
      const totalDefaultSpacesW = gaps * spaceW;
      const extra = Math.max(0, maxW - (wordsW + totalDefaultSpacesW));
      const extraPerGap = gaps > 0 ? extra / gaps : 0;

      let x = margin;
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        page.drawText(w, { x, y: cursorY, size: 10.5, font: fontBody, color: c.ink });
        x += fontBody.widthOfTextAtSize(w, 10.5);
        if (wi < gaps) x += spaceW + extraPerGap;
      }
      cursorY -= lineHeight;
    }
    
    cursorY -= 8;
  };

  const drawBullet = (text) => {
    const bullet = "•";
    const textIndent = 20;
    const maxW = width - margin * 2 - textIndent;
    const lines = wrapText(text, fontBody, 10.5, maxW);
    if (!lines.length) return;
    
    ensureSpace(lineHeight);
    
    // Puce colorée
    page.drawText(bullet, { 
      x: margin + 2, 
      y: cursorY, 
      size: 12, 
      font: fontBodyBold, 
      color: c.secondary 
    });
    
    // Première ligne avec justification
    const firstLineWords = String(lines[0] || "").split(/\s+/).filter(Boolean);
    if (lines.length === 1 || firstLineWords.length <= 1) {
      // Une seule ligne ou ligne courte : pas de justification
      page.drawText(lines[0], { 
        x: margin + textIndent, 
        y: cursorY, 
        size: 10.5, 
        font: fontBody, 
        color: c.ink 
      });
    } else {
      // Justification complète pour la première ligne si ce n'est pas la dernière
      const spaceW = fontBody.widthOfTextAtSize(" ", 10.5);
      const wordsW = firstLineWords.reduce((acc, w) => acc + fontBody.widthOfTextAtSize(w, 10.5), 0);
      const gaps = firstLineWords.length - 1;
      const totalDefaultSpacesW = gaps * spaceW;
      const extra = Math.max(0, maxW - (wordsW + totalDefaultSpacesW));
      const extraPerGap = gaps > 0 ? extra / gaps : 0;

      let x = margin + textIndent;
      for (let wi = 0; wi < firstLineWords.length; wi++) {
        const w = firstLineWords[wi];
        page.drawText(w, { x, y: cursorY, size: 10.5, font: fontBody, color: c.ink });
        x += fontBody.widthOfTextAtSize(w, 10.5);
        if (wi < gaps) x += spaceW + extraPerGap;
      }
    }
    
    cursorY -= lineHeight;
    
    // Lignes suivantes avec justification (sauf la dernière)
    for (let i = 1; i < lines.length; i++) {
      ensureSpace(lineHeight);
      const line = lines[i];
      const words = String(line || "").split(/\s+/).filter(Boolean);
      const isLastLine = i === lines.length - 1;
      
      if (isLastLine || words.length <= 1) {
        // Dernière ligne : alignée à gauche
        page.drawText(line, { 
          x: margin + textIndent, 
          y: cursorY, 
          size: 10.5, 
          font: fontBody, 
          color: c.ink 
        });
      } else {
        // Justification complète
        const spaceW = fontBody.widthOfTextAtSize(" ", 10.5);
        const wordsW = words.reduce((acc, w) => acc + fontBody.widthOfTextAtSize(w, 10.5), 0);
        const gaps = words.length - 1;
        const totalDefaultSpacesW = gaps * spaceW;
        const extra = Math.max(0, maxW - (wordsW + totalDefaultSpacesW));
        const extraPerGap = gaps > 0 ? extra / gaps : 0;

        let x = margin + textIndent;
        for (let wi = 0; wi < words.length; wi++) {
          const w = words[wi];
          page.drawText(w, { x, y: cursorY, size: 10.5, font: fontBody, color: c.ink });
          x += fontBody.widthOfTextAtSize(w, 10.5);
          if (wi < gaps) x += spaceW + extraPerGap;
        }
      }
      cursorY -= lineHeight;
    }
    cursorY -= 2;
  };

  // Charger le logo
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

  // Dessiner l'en-tête
  drawHeader();
  cursorY -= 25;
  
  // Logo centré
  drawCenteredLogo(logoImage);
  
  // Titre principal
  drawMainTitle("Contrat de prestation de service");

  // Extraction du RCS depuis la ville
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
    PRESTA_EMAIL: data.prestataire_email || "___________",
    PRESTA_TELEPHONE: data.prestataire_telephone || "___________",
    PRESTA_REPRESENTANT: `${data.prestataire_prenom || ""} ${data.prestataire_nom || ""}`.trim() || data.prestataire_representant || "___________",
    PRESTA_FONCTION: data.prestataire_fonction || "représentant de la personne morale",
    PRESTA_RCS: extraireVilleRCS(data.prestataire_adresse),
    DATE_DEBUT: data.date_debut || "01/10/2025",
    DATE_FIN: data.date_fin || "31/08/2026",
    TAUX_HORAIRE: data.taux_journalier || "25",
    EMPLOYER_ADRESSE: data.employer_adresse || "36 Avenue de l'Europe, 78140 Vélizy-Villacoublay",
    EMPLOYER_SIREN: data.employer_siren || "893 395 608",
    EMPLOYER_SIRET: data.employer_siret || "___________",
    EMPLOYER_RCS: data.employer_rcs || "VERSAILLES",
    EMPLOYER_DENOMINATION: data.employer_denomination || "CAPLOGY SERVICES",
    EMPLOYER_FORME: data.employer_forme_juridique || "SAS",
    EMPLOYER_CAPITAL: data.employer_capital || "",
    EMPLOYER_REPRESENTANT: data.employer_representant || "___________",
    EMPLOYER_FONCTION: data.employer_fonction || "representant de la personne morale",
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

  // En-tête parties contractantes
  drawPartiesHeader();

  // Bloc Société
  drawPartyBlock("LA SOCIÉTÉ", [
    ["Dénomination", tokens.EMPLOYER_DENOMINATION],
    ["Forme juridique", tokens.EMPLOYER_CAPITAL ? `${tokens.EMPLOYER_FORME} (capital : ${tokens.EMPLOYER_CAPITAL})` : tokens.EMPLOYER_FORME],
    ["SIREN/SIRET", tokens.EMPLOYER_SIRET || tokens.EMPLOYER_SIREN],
    ["RCS", tokens.EMPLOYER_RCS],
    ["Siège social", tokens.EMPLOYER_ADRESSE],
    ["Représentant", tokens.EMPLOYER_REPRESENTANT],
    ["Fonction", tokens.EMPLOYER_FONCTION],
  ], true);

  cursorY -= 8;
  
  // Texte "ci-après dénommée"
  const denom1 = "Ci-après dénommée « la société »";
  const denom1Width = fontItalic.widthOfTextAtSize(denom1, 10);
  page.drawText(denom1, {
    x: (width - denom1Width) / 2,
    y: cursorY,
    size: 10,
    font: fontItalic,
    color: c.muted,
  });
  cursorY -= 25;

  // Séparateur "ET"
  const etText = "ET";
  const etWidth = fontHeading.widthOfTextAtSize(etText, 12);
  const etX = (width - etWidth) / 2;
  
  page.drawRectangle({
    x: margin,
    y: cursorY - 8,
    width: (width - margin * 2 - etWidth - 20) / 2,
    height: 1,
    color: c.line,
  });
  
  page.drawText(etText, {
    x: etX,
    y: cursorY - 5,
    size: 12,
    font: fontHeading,
    color: c.primary,
  });
  
  page.drawRectangle({
    x: etX + etWidth + 10,
    y: cursorY - 8,
    width: (width - margin * 2 - etWidth - 20) / 2,
    height: 1,
    color: c.line,
  });
  
  cursorY -= 25;

  // Bloc Prestataire
  drawPartyBlock("LE PRESTATAIRE FORMATEUR", [
    ["Dénomination", tokens.PRESTA_DENOMINATION],
    ["Nom / Prénom", `${data.prestataire_prenom || ""} ${data.prestataire_nom || ""}`.trim() || "___________"],
    ["SIREN/SIRET", tokens.PRESTA_SIRET || tokens.PRESTA_SIREN],
    ["RCS", `${tokens.PRESTA_RCS}`],
    ["Siège social", tokens.PRESTA_ADRESSE],
    ["Email", tokens.PRESTA_EMAIL],
    ["Téléphone", tokens.PRESTA_TELEPHONE],
    ["Représentant", tokens.PRESTA_REPRESENTANT],
  ], false);

  cursorY -= 8;
  
  // Texte "ci-après dénommé"
  const denom2 = "Ci-après dénommé « le prestataire formateur »";
  const denom2Width = fontItalic.widthOfTextAtSize(denom2, 10);
  page.drawText(denom2, {
    x: (width - denom2Width) / 2,
    y: cursorY,
    size: 10,
    font: fontItalic,
    color: c.muted,
  });
  cursorY -= 30;

  // Articles du contrat
  const lines = [
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
    if (lineTrim.startsWith("Article")) {
      drawSectionTitle(lineTrim);
      continue;
    }
    if (lineTrim.startsWith("•") || lineTrim.startsWith("●")) {
      drawBullet(lineTrim.replace(/^(?:•|●)\s?/, ""));
      continue;
    }
    drawParagraph(sanitizePdfText(line));
  }

  // Lieu et date de signature
  ensureSpace(50);
  cursorY -= 10;
  
  const dateText = `Fait à ${data.lieu_signature || "Vélizy-Villacoublay"}, le ${data.date_signature || "01/10/2025"}`;
  const dateWidth = fontBodyBold.widthOfTextAtSize(dateText, 11);
  page.drawText(dateText, {
    x: (width - dateWidth) / 2,
    y: cursorY,
    size: 11,
    font: fontBodyBold,
    color: c.ink,
  });
  
  cursorY -= 35;

  // Zones de signature améliorées
  const signBoxW = (width - margin * 2 - 30) / 2;
  const signBoxH = 110;
  ensureSpace(signBoxH + 20);

  // Signature prestataire
  page.drawRectangle({ 
    x: margin, 
    y: cursorY - signBoxH, 
    width: signBoxW, 
    height: signBoxH, 
    borderColor: c.secondary, 
    borderWidth: 1.5, 
    color: c.white 
  });
  
  // Bandeau titre prestataire
  page.drawRectangle({ 
    x: margin, 
    y: cursorY - 28, 
    width: signBoxW, 
    height: 28, 
    color: c.primary 
  });
  
  page.drawText("POUR LE PRESTATAIRE", { 
    x: margin + 12, 
    y: cursorY - 18, 
    size: 10, 
    font: fontHeading, 
    color: c.white 
  });
  
  page.drawText("Signature précédée de la mention", { 
    x: margin + 12, 
    y: cursorY - 42, 
    size: 8.5, 
    font: fontUI, 
    color: c.muted 
  });
  
  page.drawText("« Lu et approuvé »", { 
    x: margin + 12, 
    y: cursorY - 54, 
    size: 8.5, 
    font: fontBodyBold, 
    color: c.ink 
  });

  // Signature entreprise
  const signX2 = margin + signBoxW + 30;
  
  page.drawRectangle({ 
    x: signX2, 
    y: cursorY - signBoxH, 
    width: signBoxW, 
    height: signBoxH, 
    borderColor: c.secondary, 
    borderWidth: 1.5, 
    color: c.white 
  });
  
  // Bandeau titre entreprise
  page.drawRectangle({ 
    x: signX2, 
    y: cursorY - 28, 
    width: signBoxW, 
    height: 28, 
    color: c.primary 
  });
  
  page.drawText("POUR L'ENTREPRISE", { 
    x: signX2 + 12, 
    y: cursorY - 18, 
    size: 10, 
    font: fontHeading, 
    color: c.white 
  });
  
  page.drawText("Signature précédée de la mention", { 
    x: signX2 + 12, 
    y: cursorY - 42, 
    size: 8.5, 
    font: fontUI, 
    color: c.muted 
  });
  
  page.drawText("« Lu et approuvé »", { 
    x: signX2 + 12, 
    y: cursorY - 54, 
    size: 8.5, 
    font: fontBodyBold, 
    color: c.ink 
  });

  // Insérer la signature si disponible
  let signatureImage = null;
  if (data.signature_data_url && data.signature_confirmed) {
    try {
      const base64Data = data.signature_data_url.includes(',') 
        ? data.signature_data_url.split(",")[1] 
        : data.signature_data_url;
      
      const bytes = Buffer.from(base64Data, "base64");
      
      // Détecter le format de l'image (PNG ou JPEG)
      const isPng = data.signature_data_url.includes('image/png');
      
      if (isPng) {
        signatureImage = await pdfDoc.embedPng(bytes);
      } else {
        // Tenter JPEG si ce n'est pas PNG
        signatureImage = await pdfDoc.embedJpg(bytes);
      }
    } catch (error) {
      console.warn("Erreur chargement signature:", error.message);
      signatureImage = null;
    }
  }
  
  if (signatureImage) {
    const padX = 15;
    const padY = 20;
    const maxW = signBoxW - padX * 2;
    const maxH = signBoxH - 65;
    const scale = Math.min(maxW / signatureImage.width, maxH / signatureImage.height);
    const w = signatureImage.width * scale;
    const h = signatureImage.height * scale;
    const x = margin + padX + (maxW - w) / 2;
    const y = cursorY - signBoxH + padY + (maxH - h) / 2;
    
    page.drawImage(signatureImage, { x, y, width: w, height: h });
  }

  cursorY -= signBoxH + 25;

  // Pied de page élégant
  ensureSpace(40);
  
  // Ligne de séparation
  page.drawRectangle({
    x: margin,
    y: cursorY,
    width: width - margin * 2,
    height: 1,
    color: c.line,
  });
  
  cursorY -= 15;
  
  const footerText = `CAPLOGY SAS - Siège social : ${tokens.EMPLOYER_ADRESSE} - N° SIREN : ${tokens.EMPLOYER_SIREN} - RCS ${tokens.EMPLOYER_RCS}`;
  const footerLines = wrapText(footerText, fontUI, 8, width - margin * 2);
  
  for (const line of footerLines) {
    const lineW = fontUI.widthOfTextAtSize(line, 8);
    const x = (width - lineW) / 2;
    page.drawText(line, {
      x,
      y: cursorY,
      size: 8,
      font: fontUI,
      color: c.muted,
    });
    cursorY -= 11;
  }

  return await pdfDoc.save();
}
