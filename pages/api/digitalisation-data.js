export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = String(req.query.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Query entreprise requise" });
  }

  // TODO: brancher ici le vrai worker de scraping Societe.com.
  // Cette version renvoie une reponse mock realiste pour debloquer le flow UI.
  const key = query.toLowerCase();
  const map = {
    caplogy: {
      company: {
        name: "CAPLOGY SERVICES",
        siret: "89339560800027",
        siren: "893395608",
        address: "16 RUE GRANGE DAME ROSE, 78140 VELIZY VILLACOUBLAY",
        city: "Velizy-Villacoublay",
      },
      employees: [
        {
          id: "cap-1",
          fullName: "Anis Benaicha",
          role: "Formateur Developpement Web",
          email: "anis.benaicha@caplogy.fr",
          startDate: "2026-01-03",
          endDate: "2026-02-28",
        },
        {
          id: "cap-2",
          fullName: "Lea Martin",
          role: "Consultante IT",
          email: "lea.martin@caplogy.fr",
          startDate: "2026-01-06",
          endDate: "2026-03-15",
        },
      ],
    },
    novatiel: {
      company: {
        name: "NOVATIEL",
        siret: "52100000000011",
        siren: "521000000",
        address: "12 AVENUE VICTOR HUGO, 75016 PARIS",
        city: "Paris",
      },
      employees: [
        {
          id: "nov-1",
          fullName: "Camille Roux",
          role: "Formateur Data",
          email: "camille.roux@novatiel.fr",
          startDate: "2026-02-01",
          endDate: "2026-04-30",
        },
      ],
    },
    doctrina: {
      company: {
        name: "DOCTRINA",
        siret: "79999999900019",
        siren: "799999999",
        address: "48 RUE DE LA REPUBLIQUE, 69002 LYON",
        city: "Lyon",
      },
      employees: [
        {
          id: "doc-1",
          fullName: "Nora El Baki",
          role: "Formatrice Cybersecurite",
          email: "nora.elbaki@doctrina.fr",
          startDate: "2026-01-15",
          endDate: "2026-05-15",
        },
      ],
    },
  };

  const payload = map[key] || map.caplogy;

  return res.status(200).json({
    source: "mock",
    query,
    company: payload.company,
    employees: payload.employees,
  });
}
