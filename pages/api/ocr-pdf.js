// pages/api/ocr-pdf.js
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

export const config = {
  api: { bodyParser: { sizeLimit: "35mb" } },
};

function b64ToUint8(b64) {
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf);
}

async function renderPdfPageToPngBuffer(pdf, pageNum, scale = 3.0) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer("image/png");
}

async function preprocessForOcr(pngBuffer) {
  // Pré-traitement agressif: améliore énormément les diplômes/scan
  return sharp(pngBuffer)
    .grayscale()
    .normalize() // augmente contraste
    .sharpen()
    .threshold(180) // binarisation
    .png()
    .toBuffer();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { fileBase64, maxPages = 1 } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: "fileBase64 manquant" });

    const pdfData = b64ToUint8(fileBase64);
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    const pagesToProcess = Math.min(Math.max(1, maxPages || 1), pdf.numPages);

    const worker = await createWorker();
    await worker.loadLanguage("fra+eng");
    await worker.initialize("fra+eng");

    let fullText = "";

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const png = await renderPdfPageToPngBuffer(pdf, pageNum, 3.2); // ↑ résolution
      const pre = await preprocessForOcr(png);

      const { data } = await worker.recognize(pre);
      const t = (data?.text || "").trim();
      if (t) fullText += "\n" + t;
    }

    await worker.terminate();

    const out = (fullText || "").trim();
    return res.status(200).json({
      texteCV: out,
      meta: { pages: pagesToProcess, pdf_pages: pdf.numPages, text_length: out.length },
    });
  } catch (err) {
    console.error("ocr-pdf error:", err);
    return res.status(500).json({ error: err.message || "Erreur OCR PDF" });
  }
}
