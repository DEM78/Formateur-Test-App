import fs from "fs";
import path from "path";

function toIdFromFileName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const dir = path.join(process.cwd(), "digitalisation_templates");
    if (!fs.existsSync(dir)) {
      return res.status(200).json({ templates: [] });
    }

    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => /\.(pdf|docx|txt)$/i.test(name))
      .map((name) => ({
        id: toIdFromFileName(name),
        name,
        displayName: name.replace(/\.[a-z0-9]+$/i, ""),
      }));

    return res.status(200).json({ templates: files });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Erreur lecture templates" });
  }
}
