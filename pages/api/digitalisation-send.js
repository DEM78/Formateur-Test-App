export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { templateId, company, employee, content } = req.body || {};
  if (!templateId || !company || !employee || !content) {
    return res.status(400).json({ error: "Payload incomplet" });
  }

  // TODO: brancher ici le vrai envoi (email, workflow admin, archive R2, etc.).
  // On renvoie OK pour valider le parcours front.
  return res.status(200).json({
    ok: true,
    message: "Document prepare et envoye (mode mock).",
  });
}
