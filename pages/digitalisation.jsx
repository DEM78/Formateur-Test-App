import { useEffect, useMemo, useRef, useState } from "react";

const TEMPLATE_DEFINITIONS = {
  "attestation-de-fin-stage-caplogy": {
    id: "attestation-de-fin-stage-caplogy",
    title: "Attestation de fin de stage",
    category: "RH",
    description: "Document officiel de fin de stage",
    color: "#6366f1",
    accent: "#a5b4fc",
    icon: "🎓",
    filename: "attestation-fin-stage",
  },
  "attestation-employeur-larissa": {
    id: "attestation-employeur-larissa",
    title: "Attestation employeur",
    category: "RH",
    description: "Attestation pour justificatif administratif",
    color: "#0ea5e9",
    accent: "#7dd3fc",
    icon: "🏢",
    filename: "attestation-employeur",
  },
  "renouvellement-periode-d-essai-test": {
    id: "renouvellement-periode-d-essai-test",
    title: "Renouvellement période d'essai",
    category: "RH",
    description: "Prolongation de la période d'essai",
    color: "#f59e0b",
    accent: "#fcd34d",
    icon: "🔄",
    filename: "renouvellement-periode-essai",
  },
  "rupture-periode-d-essai": {
    id: "rupture-periode-d-essai",
    title: "Rupture période d'essai",
    category: "RH",
    description: "Notification de rupture en période d'essai",
    color: "#ef4444",
    accent: "#fca5a5",
    icon: "📋",
    filename: "rupture-periode-essai",
  },
  "materiels-informatiques-collaborateurs-airtable-1-1": {
    id: "materiels-informatiques-collaborateurs-airtable-1-1",
    title: "Materiels informatiques - Collaborateurs",
    category: "RH",
    description: "Remise de badge et matériel d'accès",
    color: "#14b8a6",
    accent: "#99f6e4",
    icon: "💻",
    filename: "materiels-informatiques-collaborateurs",
  },
};

const TEMPLATE_REQUIREMENTS = {
  "attestation-de-fin-stage-caplogy": [
    "company_name","company_address","employee_full_name","employee_birth_date",
    "employee_nationality","employee_home_address","employee_school",
    "start_date","end_date","stage_total_hours","city","today",
  ],
  "attestation-employeur-larissa": [
    "company_name","company_siret","employee_full_name","employee_role",
    "employee_email","start_date","end_date","city","today",
  ],
  "renouvellement-periode-d-essai-test": [
    "company_name","employee_full_name","employee_role","start_date","end_date","city","today",
  ],
  "rupture-periode-d-essai": [
    "company_name","employee_full_name","employee_role","start_date","end_date","city","today",
  ],
  "materiels-informatiques-collaborateurs-airtable-1-1": [
    "company_name","company_siret","employee_full_name","employee_email","employee_role","city","today",
  ],
};

const FIELD_LABELS = {
  company_name: "Nom entreprise", company_siret: "SIRET", company_address: "Adresse entreprise",
  employee_full_name: "Nom complet salarié", employee_role: "Fonction", employee_email: "Email salarié",
  employee_birth_date: "Date de naissance", employee_nationality: "Nationalité",
  employee_home_address: "Adresse personnelle", employee_school: "Etablissement",
  start_date: "Date début", end_date: "Date fin", stage_total_hours: "Durée totale (heures)",
  city: "Fait à", today: "Fait le",
};

function todayIso() { return new Date().toISOString().slice(0, 10); }

function formatDateFr(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y,m,d]=v.split("-"); return `${d}/${m}/${y}`; }
  return v;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script_load_error")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("script_load_error"));
    document.head.appendChild(script);
  });
}

/* ─── SHARED DOCUMENT SHELL ─────────────────────────────── */
const DOC_FONT = "'Times New Roman', serif";
const DOC_SANS = "Arial, sans-serif";

function DocShell({ children, footer = "CAPLOGY INNOVATION - Siège social : 36 Avenue de l'Europe, 78140 Vélizy-Villacoublay", logoVariant = "innovation" }) {
  return (
    <div style={{ fontFamily: DOC_SANS, fontSize: 12, color: "#000", background: "#fff", padding: "32px 48px 24px", minHeight: "100%", position: "relative", lineHeight: 1.5 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 36, height: 36, background: "#e91e8c", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 20, fontFamily: DOC_SANS }}>C</span>
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#222", fontFamily: DOC_SANS, letterSpacing: "-0.5px" }}>caplogy</span>
          {logoVariant === "innovation" && <span style={{ fontSize: 9, color: "#e91e8c", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginLeft: 2, marginTop: -10 }}>INNOVATION</span>}
        </div>
      </div>
      {children}
      {/* Footer */}
      <div style={{ borderTop: "1.5px solid #ccc", marginTop: 32, paddingTop: 8, textAlign: "center", fontSize: 10.5, color: "#444" }}>
        {footer}
      </div>
    </div>
  );
}

/* ─── ATTESTATION EMPLOYEUR ─────────────────────────────── */
function DocAttestationEmployeur({ v }) {
  return (
    <DocShell footer="CAPLOGY INNOVATION - Siège social : 36 Avenue de l'Europe, 78140 Vélizy Villacoublay">
      {/* Title */}
      <div style={{ border: "1.5px solid #333", textAlign: "center", padding: "12px 20px", marginBottom: 28, marginLeft: 16, marginRight: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "1px" }}>ATTESTATION EMPLOYEUR</span>
      </div>
      <p style={{ marginBottom: 20, fontSize: 12 }}>
        Je soussigné(e), <strong>{v.companyName}</strong>, dont le siège est situé au {v.companyAddress}, SIRET n°{v.companySiret}, atteste par la présente les éléments suivants concernant notre salarié(e), {v.employeeDisplayName}&nbsp;:
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 16px" }}>
        {[
          `Né(e) le ${v.birthDate}`,
          `De nationalité ${v.nationality}`,
          `Demeurant au ${v.homeAddress}`,
          `En contrat de travail (CDI)`,
          `Depuis le ${v.startDate}`,
          `En qualité de ${v.employeeRole}`,
          `Email : ${v.employeeEmail}`,
        ].map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
            <span style={{ color: "#e91e8c", fontSize: 16, lineHeight: 1.2 }}>●</span>
            <span style={{ background: "#ffff00", padding: "1px 4px", fontSize: 12 }}>{item}</span>
          </li>
        ))}
      </ul>
      <p style={{ marginBottom: 20, background: "#ffff00", padding: "2px 6px", display: "inline-block", fontSize: 12 }}>
        {v.employeeDisplayName} n'est pas en cours de préavis à la suite d'une démission ou licenciement.
      </p>
      <p style={{ marginTop: 16, fontSize: 12 }}>Pour servir et valoir à qui de droit,</p>
      <p style={{ fontSize: 12 }}>Fait {v.issueCity},</p>
      <p style={{ fontSize: 12, marginBottom: 40 }}>le {v.issueDate}.</p>
      <p style={{ fontSize: 12 }}>Pour la société,</p>
    </DocShell>
  );
}

/* ─── RENOUVELLEMENT PÉRIODE D'ESSAI ───────────────────── */
function DocRenouvellementEssai({ v }) {
  return (
    <DocShell footer="CAPLOGY – 36 Avenue de l'Europe, 78140 – Vélizy-Villacoublay -">
      {/* Header 2-col: address left, recipient right */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32, fontSize: 12 }}>
        <div>
          <div>36 Avenue de l'Europe,</div>
          <div>78140 Velizy Villacoublay</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{v.civility}</div>
          <div style={{ fontWeight: 700 }}>{v.employeeFullName}</div>
          <div>{v.homeAddress}</div>
          <div style={{ marginTop: 8 }}>A {v.issueCity}, le {v.issueDate}</div>
        </div>
      </div>
      <p style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 24, fontSize: 12 }}>
        Objet : Renouvellement de votre période d'essai.
      </p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>{v.civility},</p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>
        Vous avez intégré notre structure en qualité <strong>{v.employeeRole}</strong> depuis le{" "}
        <span style={{ background: "#ffff00" }}>{v.startDate}</span>.
      </p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>
        Conformément aux dispositions de l'article 1 de votre contrat de travail, vous avez bénéficié d'une période d'essai de quatre mois (décalé d'autant en cas d'absence).
      </p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>
        Nous vous proposons de renouveler votre période d'essai pour une durée de quatre mois (décalé d'autant par toutes absences).
      </p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>Au terme de cette nouvelle période, votre contrat deviendra définitif.</p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>
        Jusqu'à cette date le contrat de travail pourra être rompu de votre initiative, comme la nôtre, à condition de respecter le délai de prévenance prévu aux articles L'1221-25 ou L1221-26 du Code du travail.
      </p>
      <p style={{ marginBottom: 24, fontSize: 12 }}>
        Nous vous remercions, pour la tenue de votre dossier, de bien vouloir nous retourner une copie de ce présent courriel revêtu de votre signature précédée de la mention « Bon pour accord ».
      </p>
      <p style={{ marginBottom: 32, fontSize: 12 }}>Nous vous prions d'agréer, {v.civility}, l'expression de notre considération distinguée.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
        <div>
          <div>Pour la société :</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>Monsieur Arezki ABERKANE</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Le collaborateur :</div>
          <div style={{ marginTop: 4 }}>« Bon pour accord »</div>
        </div>
      </div>
    </DocShell>
  );
}

/* ─── RUPTURE PÉRIODE D'ESSAI ───────────────────────────── */
function DocRuptureEssai({ v }) {
  return (
    <DocShell footer="CAPLOGY INNOVATION - Siège social : 16 bis rue grange dame rose, 78140 Vélizy-Villacoublay">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32, fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>
          <div>16 Bis Rue Grange Dame Rose,</div>
          <div>78140 Vélizy-Villacoublay</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{v.civility} {v.employeeFullName}</div>
          <div style={{ fontWeight: 700 }}>{v.homeAddress?.toUpperCase()}</div>
          <div style={{ marginTop: 8 }}>A Vélizy-Villacoublay, le {v.issueDate}</div>
        </div>
      </div>
      <p style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 24, fontSize: 12 }}>
        Objet : Rupture de la période d'essai.
      </p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>{v.civility},</p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>Nous sommes au regret de vous informer que nous mettons fin à votre période d'essai.</p>
      <p style={{ marginBottom: 16, fontSize: 12 }}>
        En conséquence, vous cesserez de faire partie de nos effectifs à la date du <strong>{v.endDate} au soir</strong>, cette date prenant en compte le délai de prévenance conformément à la législation en vigueur.
      </p>
      <p style={{ marginBottom: 12, fontSize: 12 }}>Pour information, le délai de prévenance est le suivant, sous réserve de dispositions conventionnelles ou contractuelles plus favorables au salarié :</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 16px" }}>
        <li style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ color: "#e91e8c", fontSize: 16, lineHeight: 1.2 }}>●</span>
          <span style={{ background: "#ffff00", fontWeight: 700, padding: "1px 4px", fontSize: 12 }}>Le salarié est présent entre 1 et 3 mois dans l'entreprise : 2 Semaines .</span>
        </li>
      </ul>
      <p style={{ marginBottom: 12, fontSize: 12 }}>Nous vous remettrons les documents suivants :</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 16px" }}>
        {["Votre dernier bulletin de salaire et son règlement ;", "Votre certificat de travail ;", "Votre reçu pour solde de tout compte ;", "L'attestation Pôle Emploi."].map((doc, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <span style={{ color: "#e91e8c", fontSize: 16, lineHeight: 1.2 }}>●</span>
            <span style={{ fontSize: 12 }}>{doc}</span>
          </li>
        ))}
      </ul>
      <p style={{ marginBottom: 32, fontSize: 12 }}>Veuillez agréer, {v.civility}, l'expression de ma considération distinguée.</p>
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>Larissa ABI ASSAF</div>
        <div>Responsable RH</div>
      </div>
    </DocShell>
  );
}

/* ─── MATÉRIELS INFORMATIQUES (Badge) ──────────────────── */
function DocMateriels({ v }) {
  return (
    <div style={{ fontFamily: DOC_SANS, fontSize: 12, color: "#000", background: "#fff", padding: "32px 48px 24px", lineHeight: 1.6 }}>
      {/* Header 2-col */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{v.companyName}</div>
          <div>{v.companyAddress}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700 }}>{v.employeeDisplayName}</div>
          <div>Demeurant au {v.homeAddress}</div>
          <div>{v.employeeEmail}</div>
        </div>
      </div>
      <p style={{ fontWeight: 700, marginBottom: 20 }}>Attestation de reconnaissance de dette et de mise à disposition d'un badge</p>
      <p style={{ marginBottom: 16 }}>Madame, Monsieur,</p>
      <p style={{ marginBottom: 16 }}>
        Afin de vous faciliter l'accès à nos locaux sis au : {v.companyAddress}, nous vous avons confié, pendant toute la durée de votre présent contrat, le matériel suivant :
      </p>
      <p style={{ marginBottom: 16 }}>
        Un badge d'accès, Numéro : <span style={{ color: "#e91e8c", fontWeight: 700 }}>_______________</span>
      </p>
      <p style={{ marginBottom: 12 }}>Ce badge demeure la propriété de l'entreprise. Vous vous engagez à en assurer le bon usage et à le maintenir en parfait état de fonctionnement.</p>
      <p style={{ marginBottom: 12 }}>En cas de dysfonctionnement ou de problème lié à ce badge, vous devrez en informer sans délai votre hiérarchie.</p>
      <p style={{ marginBottom: 12 }}>Il est important de noter que, en cas de perte, de vol ou de non-restitution du badge à la fin de votre contrat, une somme de <strong>49,20 euros</strong> correspondant à sa valeur pourra être retenue sur votre prochain bulletin de paie.</p>
      <p style={{ marginBottom: 12 }}>Par la présente, vous vous engagez à restituer ce badge en bon état de fonctionnement à l'entreprise lors de la cessation de vos fonctions, quel qu'en soit le motif.</p>
      <p style={{ marginBottom: 20 }}>Veuillez signer cette attestation, précédée de la mention " lu et approuvé ".</p>
      <p style={{ marginBottom: 32 }}>Nous vous prions d'agréer, Madame, Monsieur, nos salutations distinguées.</p>
      <p style={{ marginBottom: 4 }}>Fait à {v.issueCity} le : {v.issueDate}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 40 }}>Signature du salarié</div>
          <div style={{ fontStyle: "italic", color: "#555" }}>Lu et approuvé</div>
          <div style={{ borderBottom: "1px solid #000", width: 140, marginTop: 4 }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 40 }}>Signature et cachet de l'entreprise</div>
          <div style={{ borderBottom: "1px solid #000", width: 140, marginTop: 44 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── ATTESTATION FIN DE STAGE ──────────────────────────── */
function DocFinStage({ v }) {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 6, fontSize: 12 }}>{title}</p>
      {children}
    </div>
  );
  return (
    <DocShell footer="Caplogy Innovation - Siège social : 36 Avenue de l'Europe, 78140 Velizy-Villacoublay">
      {/* Bordered title */}
      <div style={{ border: "1.5px solid #333", textAlign: "center", padding: "14px 20px", marginBottom: 30, marginLeft: 16, marginRight: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Attestation de fin de Stage</span>
      </div>
      <Section title="Organisme d'accueil">
        <p style={{ fontSize: 12, margin: "0 0 2px" }}>Nom ou dénomination sociale : <strong>{v.companyName}</strong></p>
        <p style={{ fontSize: 12, margin: 0 }}>Adresse : {v.companyAddress}</p>
      </Section>
      <Section title="Certifie que le Stagiaire">
        <p style={{ fontSize: 12, margin: "0 0 4px" }}>{v.employeeDisplayName},</p>
        <p style={{ fontSize: 12, margin: "0 0 4px" }}>
          Né(e) le <strong>{v.birthDate}</strong>, de nationalité <strong>{v.nationality}</strong>,
        </p>
        <p style={{ fontSize: 12, margin: "0 0 4px" }}>Demeurant {v.homeAddress},</p>
        <p style={{ fontSize: 12, margin: 0 }}>Étudiant(e) à {v.school}.</p>
      </Section>
      <Section title="Durée du stage">
        <p style={{ fontSize: 12, margin: "0 0 4px" }}>
          Date de début et de fin de stage : du <strong>{v.startDate}</strong> au <strong>{v.endDate}</strong>,
        </p>
        <p style={{ fontSize: 12, margin: 0 }}>
          Représentant une durée totale de stage de <strong>{v.totalHours}</strong> dans l'organisme d'accueil.
        </p>
      </Section>
      <Section title="Montant de la gratification versé au stagiaire">
        <p style={{ fontSize: 12, margin: 0 }}>Le stagiaire n'a pas perçu de gratification mensuelle de stage.</p>
      </Section>
      <p style={{ fontSize: 12, margin: "0 0 2px" }}>Fait à {v.issueCity},</p>
      <p style={{ fontSize: 12, marginBottom: 32 }}>Le {v.issueDate}.</p>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 12, margin: "0 0 2px" }}>Responsable des ressources humaines,</p>
        <p style={{ fontSize: 12, margin: "0 0 28px" }}>Larissa ABI ASSAF.</p>
        {/* Stamp */}
        <div style={{ display: "inline-block", border: "2px solid #333", padding: "8px 20px", fontSize: 11 }}>
          <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: "1px" }}>CAPLOGY SAS</div>
          <div>36 Avenue de l'Europe</div>
          <div>78140 Vélizy-Villacoublay</div>
          <div>RCS Versailles 893 395 608</div>
        </div>
      </div>
    </DocShell>
  );
}

export default function TemplatesPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [hoveredTemplateId, setHoveredTemplateId] = useState(null);
  const [templateFiles, setTemplateFiles] = useState([]);
  const [designChosen, setDesignChosen] = useState(false);
  const [employerChoice, setEmployerChoice] = useState("caplogy");
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [company, setCompany] = useState({ name: "", address: "", siret: "", city: "" });
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    fullName: "", civility: "Monsieur", role: "", email: "",
    birthDate: "", nationality: "", homeAddress: "", homePostalCode: "",
    homeCity: "", school: "", startDate: "", endDate: "", totalHours: "",
  });
  const [issueMeta, setIssueMeta] = useState({ city: "", date: "" });
  const [todayValue, setTodayValue] = useState("");
  const previewRef = useRef(null);

  useEffect(() => { setTodayValue(todayIso()); }, []);

  useEffect(() => {
    setIssueMeta((prev) => ({
      city: prev.city || company.city || "",
      date: prev.date || todayValue || "",
    }));
  }, [company.city, todayValue]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/digitalisation-templates");
        const data = await res.json();
        if (!res.ok) return;
        setTemplateFiles(data.templates || []);
      } catch { setTemplateFiles([]); }
    };
    run();
  }, []);

  useEffect(() => {
    const autoFillCompany = async () => {
      setLoadingCompany(true);
      try {
        const res = await fetch(`/api/employer?company=${employerChoice}`);
        const data = await res.json();
        if (res.ok && data?.employer) {
          const e = data.employer;
          const address = e.adresse || "";
          const city = String(address).split(",").slice(-1)[0]?.trim() || "";
          setCompany({ name: e.denomination || "", address, siret: e.siret || e.siren || "", city });
        }
      } finally { setLoadingCompany(false); }
    };
    autoFillCompany();
  }, [employerChoice]);

  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? TEMPLATE_DEFINITIONS[selectedTemplateId] : null),
    [selectedTemplateId]
  );

  const selectedTemplateFile = useMemo(
    () => templateFiles.find((f) => f.id === selectedTemplateId) || null,
    [templateFiles, selectedTemplateId]
  );

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const liveEmployee = useMemo(() => {
    if (selectedEmployee) return selectedEmployee;
    if (newEmployee.fullName || newEmployee.role || newEmployee.email) return newEmployee;
    return null;
  }, [selectedEmployee, newEmployee]);

  const stageTemplateVars = useMemo(() => {
    const fullName = liveEmployee?.fullName || "___";
    const civility = liveEmployee?.civility || "Monsieur";
    const displayName = `${civility} ${fullName}`.trim();
    const homeAddress = [
      liveEmployee?.homeAddress || "",
      [liveEmployee?.homePostalCode || "", liveEmployee?.homeCity || ""].filter(Boolean).join(" "),
    ].filter(Boolean).join(" ");
    return {
      companyName: company.name || "___",
      companySiret: company.siret || "___",
      companyAddress: company.address || "___",
      civility,
      employeeDisplayName: displayName,
      employeeFullName: fullName,
      employeeRole: liveEmployee?.role || "___",
      employeeEmail: liveEmployee?.email || "___",
      birthDate: formatDateFr(liveEmployee?.birthDate) || "___",
      nationality: liveEmployee?.nationality || "___",
      homeAddress: homeAddress || "___",
      school: liveEmployee?.school || "___",
      startDate: formatDateFr(liveEmployee?.startDate) || "___",
      endDate: formatDateFr(liveEmployee?.endDate) || "___",
      totalHours: liveEmployee?.totalHours ? `${liveEmployee.totalHours} heures/semaine` : "___",
      issueCity: issueMeta.city || "___",
      issueDate: formatDateFr(issueMeta.date) || "___",
    };
  }, [company, issueMeta, liveEmployee]);

  const currentData = useMemo(() => ({
    company_name: company.name || "",
    company_siret: company.siret || "",
    company_address: company.address || "",
    employee_full_name: liveEmployee?.fullName || "",
    employee_role: liveEmployee?.role || "",
    employee_email: liveEmployee?.email || "",
    employee_birth_date: liveEmployee?.birthDate || "",
    employee_nationality: liveEmployee?.nationality || "",
    employee_home_address: liveEmployee?.homeAddress || "",
    employee_school: liveEmployee?.school || "",
    start_date: liveEmployee?.startDate || "",
    end_date: liveEmployee?.endDate || "",
    stage_total_hours: liveEmployee?.totalHours || "",
    city: issueMeta.city || "",
    today: issueMeta.date || "",
  }), [company, issueMeta, liveEmployee]);

  const missingFields = useMemo(() => {
    const needed = TEMPLATE_REQUIREMENTS[selectedTemplateId] || [];
    return needed.filter((key) => !String(currentData[key] || "").trim());
  }, [selectedTemplateId, currentData]);

  const canGenerateDocument = missingFields.length === 0;

  const pdfPreviewUrl = useMemo(() => {
    if (!selectedTemplateFile) return "";
    const params = new URLSearchParams({
      name: selectedTemplateFile.name,
      ...currentData,
      employee_display_name: stageTemplateVars.employeeDisplayName || "",
      employee_home_address: stageTemplateVars.homeAddress || "",
      t: String(Date.now()),
    });
    return `/api/digitalisation-render?${params.toString()}#zoom=page-width`;
  }, [selectedTemplateFile, currentData, stageTemplateVars]);

  /* ─── Render the correct document component ── */
  const htmlPreview = useMemo(() => {
    const v = stageTemplateVars;
    if (!selectedTemplateId) return null;
    switch (selectedTemplateId) {
      case "attestation-employeur-larissa": return <DocAttestationEmployeur v={v} />;
      case "renouvellement-periode-d-essai-test": return <DocRenouvellementEssai v={v} />;
      case "rupture-periode-d-essai": return <DocRuptureEssai v={v} />;
      case "materiels-informatiques-collaborateurs-airtable-1-1": return <DocMateriels v={v} />;
      case "attestation-de-fin-stage-caplogy": return <DocFinStage v={v} />;
      default: return null;
    }
  }, [selectedTemplateId, stageTemplateVars]);

  /* ─── Hover preview ── */
  const hoveredTemplate = hoveredTemplateId ? TEMPLATE_DEFINITIONS[hoveredTemplateId] : null;
  const previewTemplate = hoveredTemplate || selectedTemplate || Object.values(TEMPLATE_DEFINITIONS)[0];
  const hoveredTemplateFile = hoveredTemplateId ? templateFiles.find((f) => f.id === hoveredTemplateId) : null;
  const previewTemplateFile = hoveredTemplateFile || selectedTemplateFile || null;

  const handleAddEmployee = () => {
    if (!newEmployee.fullName.trim()) return;
    const employee = { id: Date.now().toString(), ...newEmployee };
    setEmployees((prev) => [...prev, employee]);
    setSelectedEmployeeId(employee.id);
    setNewEmployee({ fullName: "", civility: "Monsieur", role: "", email: "", birthDate: "", nationality: "", homeAddress: "", homePostalCode: "", homeCity: "", school: "", startDate: "", endDate: "", totalHours: "" });
    setShowAddEmployee(false);
  };

  const handleDeleteEmployee = (id) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setSelectedEmployeeId((prev) => (prev === id ? "" : prev));
  };

  const handleEmployeeFieldChange = (field, value) => {
    setNewEmployee((prev) => ({ ...prev, [field]: value }));
    if (!selectedEmployeeId) return;
    setEmployees((prev) => prev.map((emp) => emp.id === selectedEmployeeId ? { ...emp, [field]: value } : emp));
  };

  const handleDownload = async () => {
    if (!canGenerateDocument) return;

    // For HTML templates: direct PDF download from the exact right-side preview (no print dialog).
    if (htmlPreview && previewRef.current) {
      try {
        if (!window.html2canvas) {
          await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
        }
        if (!window.jspdf?.jsPDF) {
          await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
        }

        const element = previewRef.current;
        const canvas = await window.html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = 210;
        const pageHeight = 297;
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let y = 0;
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
        let heightLeft = imgHeight - pageHeight;
        while (heightLeft > 0) {
          y = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        pdf.save(`${selectedTemplate?.filename || "document"}-${Date.now()}.pdf`);
        return;
      } catch {
        alert("Impossible de générer le PDF direct, téléchargement fallback.");
      }
    }

    if (!pdfPreviewUrl) return;
    try {
      const directUrl = pdfPreviewUrl.split("#")[0];
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedTemplate?.filename || "document"}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors du téléchargement du PDF.");
    }
  };

  const handleSend = () => {
    if (!canGenerateDocument) return;
    alert("Document prêt à être envoyé.");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif", color: "#1a1a2e" }}>
      {/* Top Nav */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #eaecf0", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button type="button" onClick={() => (window.location.href = "/")} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, color: "#4b5563", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            ← Retour
          </button>
          <div style={{ width: 1, height: 24, background: "#e2e8f0" }} />
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1a1a2e", letterSpacing: "-0.3px" }}>Templates RH</span>
        </div>
        {designChosen && selectedTemplate && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", background: "#f0f1ff", padding: "6px 14px", borderRadius: 20 }}>
              {selectedTemplate.icon} {selectedTemplate.title}
            </div>
            <button onClick={() => setDesignChosen(false)} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>Changer</button>
          </div>
        )}
      </nav>

      {/* ═══ TEMPLATE PICKER ═══ */}
      {!designChosen ? (
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Étape 1</p>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, fontWeight: 400, color: "#1a1a2e", marginBottom: 10, lineHeight: 1.15 }}>Choisissez votre template</h1>
            <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 520, lineHeight: 1.6 }}>Sélectionnez un modèle de document RH. Passez la souris pour avoir un aperçu, puis cliquez pour le choisir.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
            {/* Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {Object.values(TEMPLATE_DEFINITIONS).map((template) => {
                const isSelected = selectedTemplateId === template.id;
                return (
                  <button key={template.id} onClick={() => setSelectedTemplateId(template.id)} onMouseEnter={() => setHoveredTemplateId(template.id)} onMouseLeave={() => setHoveredTemplateId(null)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ background: "#fff", borderRadius: 14, border: isSelected ? `2px solid ${template.color}` : "2px solid #eaecf0", overflow: "hidden", boxShadow: isSelected ? `0 8px 30px ${template.color}22` : "0 2px 8px rgba(0,0,0,0.05)" }}>
                      <div style={{ background: `linear-gradient(135deg, ${template.color}18 0%, ${template.accent}22 100%)`, padding: "20px 20px 0", height: 130, display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 18 }}>{template.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, background: template.color, color: "#fff", padding: "3px 10px", borderRadius: 20 }}>{template.category}</span>
                        </div>
                        <div style={{ width: "75%", paddingBottom: 0 }}>
                          {[80, 65, 90, 55, 70].map((w, i) => (
                            <div key={i} style={{ height: i === 0 ? 7 : 5, width: `${w}%`, background: i === 0 ? template.color : "#d1d5db", borderRadius: 3, marginBottom: 7, opacity: i === 0 ? 0.8 : 0.7 }} />
                          ))}
                        </div>
                      </div>
                      <div style={{ padding: "16px 20px 18px" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>{template.title}</h3>
                        <p style={{ fontSize: 12.5, color: "#9ca3af" }}>{template.description}</p>
                        {isSelected && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: template.color, marginTop: 10 }}>
                            <span style={{ width: 16, height: 16, background: template.color, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ color: "#fff", fontSize: 10 }}>✓</span>
                            </span>
                            Sélectionné
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Preview panel */}
            <div style={{ position: "sticky", top: 80 }}>
              <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #eaecf0", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
                <div style={{ background: `linear-gradient(135deg, ${previewTemplate.color}14 0%, ${previewTemplate.accent}20 100%)`, padding: "20px 24px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, background: previewTemplate.color, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{previewTemplate.icon}</div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: previewTemplate.color, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Aperçu</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{previewTemplate.title}</p>
                  </div>
                </div>
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ background: "#f9fafb", borderRadius: 10, border: "1px solid #eaecf0", minHeight: 260, overflow: "hidden" }}>
                    {previewTemplateFile ? (
                      <iframe title="preview" src={`/api/digitalisation-template-file?name=${encodeURIComponent(previewTemplateFile.name)}#view=FitH`} style={{ width: "100%", height: "560px", border: "none", background: "#fff" }} />
                    ) : (
                      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 12px", color: "#9a3412", fontSize: 12.5, fontWeight: 600, margin: 8 }}>
                        Aucun fichier template trouvé.
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: "0 24px 24px" }}>
                  <button onClick={() => { if (selectedTemplateId) setDesignChosen(true); }} style={{ width: "100%", padding: "13px", background: selectedTemplateId ? `linear-gradient(135deg, ${previewTemplate.color} 0%, ${previewTemplate.color}cc 100%)` : "#e5e7eb", color: selectedTemplateId ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: selectedTemplateId ? "pointer" : "not-allowed" }}>
                    {selectedTemplateId ? `Utiliser ce template →` : "Sélectionnez un template"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ═══ EDITOR PHASE ═══ */
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Étape 2</p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, fontWeight: 400, color: "#1a1a2e" }}>Complétez les informations</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "430px 1fr", gap: 24, alignItems: "start" }}>
            {/* Left Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Company */}
              <div style={card}>
                <div style={cardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={cardIconWrap}>🏢</span>
                    <h3 style={cardTitle}>Entreprise</h3>
                  </div>
                  {loadingCompany && <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, background: "#f0f1ff", padding: "4px 10px", borderRadius: 20 }}>Chargement...</span>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Entreprise</label>
                  <select value={employerChoice} onChange={(e) => setEmployerChoice(e.target.value)} style={inputStyle}>
                    <option value="caplogy">Caplogy</option>
                    <option value="novatiel">Novatiel</option>
                    <option value="doctrina">Doctrina</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Nom de l'entreprise</label>
                    <input type="text" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} style={inputStyle} placeholder="Ex: Caplogy SAS" />
                  </div>
                  <div>
                    <label style={labelStyle}>SIRET</label>
                    <input type="text" value={company.siret} onChange={(e) => setCompany({ ...company, siret: e.target.value })} style={inputStyle} placeholder="000 000 000 00000" />
                  </div>
                  <div>
                    <label style={labelStyle}>Ville</label>
                    <input type="text" value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} style={inputStyle} placeholder="Paris" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Adresse complète</label>
                    <input type="text" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} style={inputStyle} placeholder="12 rue de la Paix, 75001 Paris" />
                  </div>
                </div>
              </div>

              {/* Employee */}
              <div style={card}>
                <div style={cardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={cardIconWrap}>👤</span>
                    <h3 style={cardTitle}>Salarié</h3>
                  </div>
                  <button onClick={() => setShowAddEmployee((v) => { const next = !v; if (next) setSelectedEmployeeId(""); return next; })} style={{ background: showAddEmployee ? "#f5f6ff" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: showAddEmployee ? "#6366f1" : "#fff", border: showAddEmployee ? "1.5px solid #e0e2f7" : "none", borderRadius: 9, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {showAddEmployee ? "Annuler" : "+ Ajouter"}
                  </button>
                </div>
                {employees.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: showAddEmployee ? 16 : 0 }}>
                    {employees.map((emp) => (
                      <div key={emp.id} onClick={() => setSelectedEmployeeId(emp.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${selectedEmployeeId === emp.id ? "#6366f1" : "#eaecf0"}`, background: selectedEmployeeId === emp.id ? "#f5f6ff" : "#fff", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: selectedEmployeeId === emp.id ? "#6366f1" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: selectedEmployeeId === emp.id ? "#fff" : "#6b7280" }}>
                            {emp.fullName[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e" }}>{emp.fullName}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{emp.role || "—"}</div>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.id); }} style={{ background: "none", border: "none", color: "#d1d5db", fontSize: 18, cursor: "pointer" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {showAddEmployee && (
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16, border: "1.5px solid #eaecf0" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { col: "1 / -1", label: "Nom complet *", field: "fullName", type: "text", placeholder: "Jean Dupont" },
                      ].map(({ col, label, field, type, placeholder }) => (
                        <div key={field} style={{ gridColumn: col }}>
                          <label style={labelStyle}>{label}</label>
                          <input type={type} value={selectedEmployeeId ? (selectedEmployee?.[field] || "") : newEmployee[field]} onChange={(e) => handleEmployeeFieldChange(field, e.target.value)} style={inputStyle} placeholder={placeholder} />
                        </div>
                      ))}
                      <div>
                        <label style={labelStyle}>Civilité</label>
                        <select value={selectedEmployeeId ? (selectedEmployee?.civility || "Monsieur") : newEmployee.civility} onChange={(e) => handleEmployeeFieldChange("civility", e.target.value)} style={inputStyle}>
                          <option value="Monsieur">Monsieur</option>
                          <option value="Madame">Madame</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Email</label>
                        <input type="email" value={selectedEmployeeId ? (selectedEmployee?.email || "") : newEmployee.email} onChange={(e) => handleEmployeeFieldChange("email", e.target.value)} style={inputStyle} placeholder="jean.dupont@email.com" />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={labelStyle}>Fonction</label>
                        <input type="text" value={selectedEmployeeId ? (selectedEmployee?.role || "") : newEmployee.role} onChange={(e) => handleEmployeeFieldChange("role", e.target.value)} style={inputStyle} placeholder="Développeur Frontend" />
                      </div>
                      <div>
                        <label style={labelStyle}>Date de naissance</label>
                        <input type="date" value={selectedEmployeeId ? (selectedEmployee?.birthDate || "") : newEmployee.birthDate} onChange={(e) => handleEmployeeFieldChange("birthDate", e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Nationalité</label>
                        <input type="text" value={selectedEmployeeId ? (selectedEmployee?.nationality || "") : newEmployee.nationality} onChange={(e) => handleEmployeeFieldChange("nationality", e.target.value)} style={inputStyle} placeholder="Française" />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={labelStyle}>Adresse personnelle</label>
                        <input type="text" value={selectedEmployeeId ? (selectedEmployee?.homeAddress || "") : newEmployee.homeAddress} onChange={(e) => handleEmployeeFieldChange("homeAddress", e.target.value)} style={inputStyle} placeholder="10 rue Victor Hugo" />
                      </div>
                      <div>
                        <label style={labelStyle}>Code postal</label>
                        <input type="text" value={selectedEmployeeId ? (selectedEmployee?.homePostalCode || "") : newEmployee.homePostalCode} onChange={(e) => handleEmployeeFieldChange("homePostalCode", e.target.value)} style={inputStyle} placeholder="75011" />
                      </div>
                      <div>
                        <label style={labelStyle}>Ville</label>
                        <input type="text" value={selectedEmployeeId ? (selectedEmployee?.homeCity || "") : newEmployee.homeCity} onChange={(e) => handleEmployeeFieldChange("homeCity", e.target.value)} style={inputStyle} placeholder="Paris" />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={labelStyle}>Etablissement</label>
                        <input type="text" value={selectedEmployeeId ? (selectedEmployee?.school || "") : newEmployee.school} onChange={(e) => handleEmployeeFieldChange("school", e.target.value)} style={inputStyle} placeholder="Nom de l'école / organisme" />
                      </div>
                      <div>
                        <label style={labelStyle}>Date de début</label>
                        <input type="date" value={selectedEmployeeId ? (selectedEmployee?.startDate || "") : newEmployee.startDate} onChange={(e) => handleEmployeeFieldChange("startDate", e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Date de fin</label>
                        <input type="date" value={selectedEmployeeId ? (selectedEmployee?.endDate || "") : newEmployee.endDate} onChange={(e) => handleEmployeeFieldChange("endDate", e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={labelStyle}>Durée totale du stage (heures/semaine)</label>
                        <input type="text" value={selectedEmployeeId ? (selectedEmployee?.totalHours || "") : newEmployee.totalHours} onChange={(e) => handleEmployeeFieldChange("totalHours", e.target.value)} style={inputStyle} placeholder="Ex: 35" />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <button onClick={() => setShowAddEmployee(false)} style={{ flex: 1, background: "#fff", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                      <button onClick={handleAddEmployee} style={{ flex: 1, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
                    </div>
                  </div>
                )}
                {employees.length === 0 && !showAddEmployee && (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>
                    Aucun salarié ajouté. Cliquez sur <strong>+ Ajouter</strong>.
                  </div>
                )}
              </div>

              {/* Document Meta */}
              <div style={card}>
                <div style={cardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={cardIconWrap}>📝</span>
                    <h3 style={cardTitle}>Document</h3>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Fait à</label>
                    <input type="text" value={issueMeta.city} onChange={(e) => setIssueMeta((prev) => ({ ...prev, city: e.target.value }))} style={inputStyle} placeholder="Ville de signature" />
                  </div>
                  <div>
                    <label style={labelStyle}>Fait le</label>
                    <input type="date" value={issueMeta.date} onChange={(e) => setIssueMeta((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Validation */}
              {selectedTemplateId && missingFields.length > 0 && (
                <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", color: "#9a3412", fontSize: 12.5, lineHeight: 1.5 }}>
                  Champs manquants : {missingFields.map((f) => FIELD_LABELS[f] || f).join(", ")}
                </div>
              )}
              {canGenerateDocument && (
                <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "10px 14px", color: "#166534", fontSize: 12.5, fontWeight: 600 }}>
                  ✓ Document prêt à générer
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button onClick={handleDownload} style={{ background: "#fff", color: canGenerateDocument ? "#374151" : "#9ca3af", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "14px", fontSize: 13.5, fontWeight: 700, cursor: canGenerateDocument ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: canGenerateDocument ? 1 : 0.7 }}>
                  ⬇ Télécharger
                </button>
                <button onClick={handleSend} style={{ background: canGenerateDocument ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "#d1d5db", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 13.5, fontWeight: 700, cursor: canGenerateDocument ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  ✉ Envoyer
                </button>
              </div>
            </div>

            {/* Right: Live Document Preview */}
            <div style={{ position: "sticky", top: 80 }}>
              <div style={{ width: "100%", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", boxShadow: "0 10px 28px rgba(0,0,0,0.08)", overflow: "hidden", minHeight: 900 }}>
                {/* Document header bar */}
                <div style={{ background: `linear-gradient(135deg, ${selectedTemplate?.color}12, ${selectedTemplate?.accent}18)`, borderBottom: "1px solid #eaecf0", padding: "10px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ marginLeft: 10, fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                    {selectedTemplate?.title} — aperçu temps réel
                  </span>
                </div>
                {htmlPreview ? (
                  <div ref={previewRef} style={{ overflowY: "auto", maxHeight: "calc(100vh - 180px)" }}>
                    {htmlPreview}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "#9ca3af", fontSize: 14 }}>
                    Sélectionnez un template pour voir l'aperçu
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: "#fff", borderRadius: 16, padding: "22px 24px", border: "1.5px solid #eaecf0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" };
const cardHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 };
const cardIconWrap = { width: 32, height: 32, background: "#f5f6ff", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 };
const cardTitle = { fontSize: 15, fontWeight: 700, color: "#1a1a2e", margin: 0 };
const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#6b7280", marginBottom: 6, letterSpacing: "0.1px" };
const inputStyle = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "10px 12px", fontSize: 13.5, color: "#1a1a2e", background: "#fff", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" };
