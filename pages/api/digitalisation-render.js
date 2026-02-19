import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function toIdFromFileName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function asText(value) {
  return String(value || "").trim();
}

function drawField(page, font, cfg, value) {
  if (!value || !cfg) return;
  page.drawText(value, {
    x: cfg.x,
    y: cfg.y,
    size: cfg.size || 10,
    font,
    color: rgb(0, 0, 0),
    maxWidth: cfg.maxWidth || 420,
    lineHeight: cfg.lineHeight || 12,
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findItemByText(items, needle) {
  const n = normalizeText(needle);
  return items.find((it) => normalizeText(it?.str || "").includes(n));
}

function findItemExact(items, needle) {
  const n = normalizeText(needle);
  return items.find((it) => normalizeText(it?.str || "") === n);
}

function drawAfterLabel(page, font, items, label, value, opts = {}) {
  if (!value) return;
  const item = findItemByText(items, label);
  if (!item) return;
  const x = (item.transform?.[4] || 0) + (item.width || 0) + (opts.dx || 6);
  const y = (item.transform?.[5] || 0) + (opts.dy || 0);
  page.drawText(value, {
    x,
    y,
    size: opts.size || 11,
    font,
    color: rgb(0, 0, 0),
    maxWidth: opts.maxWidth || 300,
    lineHeight: opts.lineHeight || 12,
  });
}

function normalizeFieldName(name) {
  return String(name || "")
    .trim()
    .replace(/[{}]/g, "")
    .toLowerCase();
}

function fillAcroFields(doc, values) {
  try {
    const form = doc.getForm();
    const fields = form.getFields();
    if (!fields.length) return 0;

    const aliasMap = {
      company_name: ["company_name", "denomination", "entreprise_nom", "nom_entreprise"],
      company_siret: ["company_siret", "siret", "siren_siret"],
      company_address: ["company_address", "adresse", "adresse_entreprise"],
      city: ["city", "ville"],
      employee_full_name: ["employee_full_name", "nom_prenom", "nom_complet", "salarie_nom_prenom"],
      employee_display_name: ["employee_display_name", "civilite_nom_complet"],
      employee_role: ["employee_role", "fonction", "poste"],
      employee_birth_date: ["employee_birth_date", "date_naissance", "ne_le"],
      employee_nationality: ["employee_nationality", "nationalite"],
      employee_home_address: ["employee_home_address", "adresse_salarie", "demeurant"],
      employee_school: ["employee_school", "etablissement", "ecole"],
      start_date: ["start_date", "date_debut", "debut"],
      end_date: ["end_date", "date_fin", "fin"],
      stage_total_hours: ["stage_total_hours", "duree_totale_heures", "nombre_heures"],
      today: ["today", "date_du_jour", "date_signature"],
    };

    const reverse = {};
    Object.entries(aliasMap).forEach(([key, aliases]) => {
      aliases.forEach((a) => {
        reverse[normalizeFieldName(a)] = key;
      });
    });

    let filled = 0;
    fields.forEach((field) => {
      const rawName = field.getName?.() || "";
      const normalized = normalizeFieldName(rawName);
      const mappedKey = reverse[normalized] || reverse[normalized.replace(/\s+/g, "_")] || normalized;
      const value = values[mappedKey] || "";
      if (!value) return;
      if (typeof field.setText === "function") {
        field.setText(value);
        filled += 1;
      }
    });

    if (filled > 0) {
      form.flatten();
    }
    return filled;
  } catch {
    return 0;
  }
}

const OVERLAY_BY_TEMPLATE = {
  "attestation-de-fin-stage-caplogy": {
    page: 0,
    fields: {
      employee_full_name: { x: 170, y: 560, size: 10, maxWidth: 230 },
      employee_role: { x: 170, y: 535, size: 10, maxWidth: 230 },
      start_date: { x: 215, y: 512, size: 10, maxWidth: 100 },
      end_date: { x: 355, y: 512, size: 10, maxWidth: 100 },
      company_name: { x: 100, y: 485, size: 10, maxWidth: 300 },
      company_siret: { x: 100, y: 462, size: 10, maxWidth: 220 },
      today: { x: 150, y: 438, size: 10, maxWidth: 120 },
      city: { x: 95, y: 438, size: 10, maxWidth: 120 },
    },
  },
  "attestation-employeur-larissa": {
    page: 0,
    fields: {
      employee_full_name: { x: 196, y: 445, size: 10, maxWidth: 210 },
      start_date: { x: 218, y: 388, size: 10, maxWidth: 95 },
      end_date: { x: 370, y: 388, size: 10, maxWidth: 95 },
      employee_role: { x: 174, y: 365, size: 10, maxWidth: 220 },
      company_name: { x: 170, y: 343, size: 10, maxWidth: 240 },
      company_siret: { x: 130, y: 321, size: 10, maxWidth: 180 },
      company_address: { x: 170, y: 300, size: 9, maxWidth: 285 },
      city: { x: 82, y: 176, size: 10, maxWidth: 140 },
      today: { x: 156, y: 176, size: 10, maxWidth: 150 },
    },
  },
  "renouvellement-periode-d-essai-test": {
    page: 0,
    fields: {
      employee_full_name: { x: 162, y: 575, size: 10, maxWidth: 220 },
      employee_role: { x: 140, y: 548, size: 10, maxWidth: 220 },
      start_date: { x: 208, y: 522, size: 10, maxWidth: 100 },
      end_date: { x: 365, y: 522, size: 10, maxWidth: 100 },
      company_name: { x: 96, y: 495, size: 10, maxWidth: 290 },
      city: { x: 86, y: 196, size: 10, maxWidth: 130 },
      today: { x: 154, y: 196, size: 10, maxWidth: 150 },
    },
  },
  "rupture-periode-d-essai": {
    page: 0,
    fields: {
      employee_full_name: { x: 176, y: 556, size: 10, maxWidth: 230 },
      employee_role: { x: 142, y: 531, size: 10, maxWidth: 220 },
      start_date: { x: 208, y: 505, size: 10, maxWidth: 100 },
      end_date: { x: 350, y: 505, size: 10, maxWidth: 100 },
      company_name: { x: 96, y: 479, size: 10, maxWidth: 300 },
      company_siret: { x: 140, y: 455, size: 10, maxWidth: 200 },
      city: { x: 86, y: 184, size: 10, maxWidth: 130 },
      today: { x: 154, y: 184, size: 10, maxWidth: 150 },
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawName = asText(req.query.name);
  if (!rawName) return res.status(400).json({ error: "name requis" });

  const safeName = path.basename(rawName);
  const ext = path.extname(safeName).toLowerCase();
  if (ext !== ".pdf") return res.status(400).json({ error: "Seulement PDF supporte" });

  const filePath = path.join(process.cwd(), "digitalisation_templates", safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Template introuvable" });
  }

  const templateId = toIdFromFileName(safeName);
  const overlay = OVERLAY_BY_TEMPLATE[templateId];

  try {
    const bytes = fs.readFileSync(filePath);
    if (!overlay) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(bytes);
    }

    const doc = await PDFDocument.load(bytes);
    const values = {
      company_name: asText(req.query.company_name),
      company_siret: asText(req.query.company_siret),
      company_address: asText(req.query.company_address),
      city: asText(req.query.city),
      employee_display_name: asText(req.query.employee_display_name),
      employee_full_name: asText(req.query.employee_full_name),
      employee_role: asText(req.query.employee_role),
      employee_birth_date: asText(req.query.employee_birth_date),
      employee_nationality: asText(req.query.employee_nationality),
      employee_home_address: asText(req.query.employee_home_address),
      employee_school: asText(req.query.employee_school),
      start_date: asText(req.query.start_date),
      end_date: asText(req.query.end_date),
      stage_total_hours: asText(req.query.stage_total_hours),
      today: asText(req.query.today),
    };

    // Natural filling for the updated "Attestation de fin stage_CAPLOGY":
    // anchor on the real labels read from the PDF, then write values right after.
    if (templateId === "attestation-de-fin-stage-caplogy") {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const src = new Uint8Array(bytes);
        const pdf = await pdfjs.getDocument({ data: src }).promise;
        const textPage = await pdf.getPage(1);
        const textContent = await textPage.getTextContent();
        const items = textContent?.items || [];

        const page = doc.getPages()[0];
        const font = await doc.embedFont(StandardFonts.Helvetica);

        drawAfterLabel(page, font, items, "Nom ou dénomination sociale", values.company_name, { dx: 8, size: 11, maxWidth: 300 });
        drawAfterLabel(page, font, items, "Adresse:", values.company_address, { dx: 8, size: 10, maxWidth: 380 });
        drawAfterLabel(page, font, items, "Monsieur", values.employee_full_name, { dx: 8, size: 11, maxWidth: 180 });
        drawAfterLabel(page, font, items, "Né(e) le", values.employee_birth_date, { dx: 8, size: 10.5, maxWidth: 110 });
        drawAfterLabel(page, font, items, "de nationalité", values.employee_nationality, { dx: 8, size: 10.5, maxWidth: 120 });
        drawAfterLabel(page, font, items, "Demeurant", values.employee_home_address, { dx: 8, size: 10.5, maxWidth: 300 });
        drawAfterLabel(page, font, items, "Étudiant (e) à", values.employee_school, { dx: 8, size: 10.5, maxWidth: 250 });

        const stageLabel = findItemByText(items, "Date de début et de fin de stage: du");
        if (stageLabel && (values.start_date || values.end_date)) {
          const baseX = (stageLabel.transform?.[4] || 0) + (stageLabel.width || 0) + 8;
          const y = (stageLabel.transform?.[5] || 0);
          if (values.start_date) {
            page.drawText(values.start_date, {
              x: baseX,
              y,
              size: 10.5,
              font,
              color: rgb(0, 0, 0),
              maxWidth: 95,
            });
          }
          if (values.end_date) {
            page.drawText(values.end_date, {
              // Keep the end date close to the printed "au" label in the template
              x: baseX + 88,
              y,
              size: 10.5,
              font,
              color: rgb(0, 0, 0),
              maxWidth: 120,
            });
          }
        }

        drawAfterLabel(
          page,
          font,
          items,
          "Représentant une durée totale de stage de",
          values.stage_total_hours ? `${values.stage_total_hours} heures/semaine` : "",
          { dx: 8, size: 10.5, maxWidth: 210 }
        );

        drawAfterLabel(page, font, items, "Fait à", values.city, { dx: 8, size: 10.5, maxWidth: 120 });
        const leItem = findItemExact(items, "Le");
        if (leItem && values.today) {
          page.drawText(values.today, {
            x: (leItem.transform?.[4] || 0) + (leItem.width || 0) + 8,
            y: leItem.transform?.[5] || 0,
            size: 10.5,
            font,
            color: rgb(0, 0, 0),
            maxWidth: 120,
          });
        }

        const out = await doc.save();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(Buffer.from(out));
      } catch {
        // fallback below (acroform then legacy overlays)
      }
    }

    // First try filling real PDF form fields (best quality for "official template with empty fields").
    // This is what we use now for the new "Attestation de fin stage_CAPLOGY" template.
    const filledFields = fillAcroFields(doc, values);
    if (filledFields > 0) {
      const out = await doc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(Buffer.from(out));
    }

    const page = doc.getPages()[overlay.page || 0];
    const font = await doc.embedFont(StandardFonts.Helvetica);

    Object.entries(overlay.fields).forEach(([key, cfg]) => {
      drawField(page, font, cfg, values[key]);
    });

    const out = await doc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(out));
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Erreur rendu PDF" });
  }
}
