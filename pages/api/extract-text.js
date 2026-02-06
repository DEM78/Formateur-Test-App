// pages/api/extract-text.js (stable for Next.js 16 + Turbopack)
// - Pas de pdf-parse
// - Pas de pdf-to-img
// - Pas de pdf-lib
// - Texte via pdfjs-dist
// - OCR fallback via rendu PNG (pdfjs-dist + canvas) + Tesseract

import { createCanvas, loadImage } from "canvas";
import path from "path";
import { pathToFileURL } from "url";
import Tesseract from "tesseract.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export const runtime = "nodejs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: "Aucun fichier reçu" });
    }

    const buffer = Buffer.from(fileBase64, "base64");
    const uint8 = new Uint8Array(buffer); // ✅ pdfjs veut Uint8Array

    // 1) Extraction texte via pdfjs
    let text = "";
    try {
      text = await extractTextWithPdfjs(uint8);
      text = (text || "").trim();
    } catch (e) {
      console.warn("pdfjs text extraction failed:", e?.message || e);
      text = "";
    }

    // 2) Si texte suffisant -> OK
    if (text && text.length >= 100) {
      return res.status(200).json({
        texteCV: text,
        method: "pdfjs-text",
        meta: { text_length: text.length },
      });
    }

    // 3) OCR fallback
    console.log("PDF scanné détecté, lancement OCR...");

    try {
      const pngBuffer = await renderFirstPageToPng(uint8, { scale: 2.2 });
      const processedImage = await preprocessImage(pngBuffer);

      const { data } = await Tesseract.recognize(processedImage, "fra", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const ocrText = (data?.text || "").trim();

      if (ocrText && ocrText.length >= 30) {
        return res.status(200).json({
          texteCV: ocrText,
          method: "ocr-tesseract-pdfjs",
          meta: {
            text_length: text?.length || 0,
            ocr_length: ocrText.length,
          },
        });
      }

      return res.status(200).json({
        texteCV: text || ocrText || "",
        method: "ocr-failed",
        warning: "OCR n'a pas pu extraire suffisamment de texte",
        meta: {
          text_length: text?.length || 0,
          ocr_length: ocrText?.length || 0,
        },
      });
    } catch (ocrError) {
      console.error("Erreur OCR:", ocrError);
      return res.status(200).json({
        texteCV: text || "",
        method: "ocr-error",
        error: ocrError?.message || String(ocrError),
        meta: { text_length: text?.length || 0 },
      });
    }
  } catch (err) {
    console.error("Erreur globale:", err);
    return res.status(500).json({
      error: err?.message || String(err),
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
  }
}

/**
 * Extraction texte PDF via pdfjs-dist (robuste en ESM)
 */
async function extractTextWithPdfjs(uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = pathToFileURL(
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep
  ).href;

  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    disableWorker: true,
    standardFontDataUrl,
  });

  const pdfDoc = await loadingTask.promise;
  if (!pdfDoc || pdfDoc.numPages < 1) return "";

  let full = "";

  const maxPages = Math.min(pdfDoc.numPages, 6); // ✅ limite perf (ajuste si besoin)
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const strings = (content?.items || [])
      .map((it) => (it && typeof it.str === "string" ? it.str : ""))
      .filter(Boolean);

    if (strings.length) full += strings.join(" ") + "\n";
  }

  return full.trim();
}

/**
 * Rendu page 1 en PNG via pdfjs-dist + canvas
 */
async function renderFirstPageToPng(uint8Array, { scale = 2.0 } = {}) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = pathToFileURL(
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep
  ).href;

  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    disableWorker: true,
    standardFontDataUrl,
  });

  const pdfDoc = await loadingTask.promise;
  if (!pdfDoc || pdfDoc.numPages < 1) {
    throw new Error("PDF vide ou illisible (pdfjs)");
  }

  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");

  // fond blanc
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({ canvasContext: ctx, viewport });
  await renderTask.promise;

  return canvas.toBuffer("image/png");
}

/**
 * Preprocessing OCR
 */
async function preprocessImage(imageBuffer) {
  try {
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const threshold = avg > 160 ? 255 : 0;
      data[i] = threshold;
      data[i + 1] = threshold;
      data[i + 2] = threshold;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toBuffer("image/png");
  } catch (e) {
    console.warn("Preprocessing failed, using original image:", e?.message || e);
    return imageBuffer;
  }
}
