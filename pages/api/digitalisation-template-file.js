import fs from "fs";
import path from "path";

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawName = String(req.query.name || "");
  if (!rawName) {
    return res.status(400).json({ error: "name requis" });
  }

  const safeName = path.basename(rawName);
  const dir = path.join(process.cwd(), "digitalisation_templates");
  const filePath = path.join(dir, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Template introuvable" });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  const bytes = fs.readFileSync(filePath);

  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(bytes);
}
