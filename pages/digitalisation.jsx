import { useEffect, useMemo, useState } from "react";

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
    content:
      "ATTESTATION DE FIN DE STAGE\n\n" +
      "Je soussigne(e), {{company_name}}, situee au {{company_address}}, atteste que {{employee_full_name}} a effectue un stage au sein de notre entreprise.\n\n" +
      "Fonction / Service : {{employee_role}}\n" +
      "Periode : du {{start_date}} au {{end_date}}\n\n" +
      "SIRET entreprise : {{company_siret}}\n\n" +
      "Fait a {{city}}, le {{today}}.\n\n" +
      "Signature et cachet de l'entreprise.",
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
    content:
      "ATTESTATION EMPLOYEUR\n\n" +
      "Je soussigne(e), {{company_name}}, situee au {{company_address}}, SIRET {{company_siret}}, atteste que {{employee_full_name}} est employe(e) au sein de notre entreprise.\n\n" +
      "Poste occupe: {{employee_role}}\n" +
      "Periode de reference: du {{start_date}} au {{end_date}}\n\n" +
      "La presente attestation est delivree pour servir et valoir ce que de droit.\n\n" +
      "Fait a {{city}}, le {{today}}.\n\n" +
      "Signature et cachet de l'employeur.",
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
    content:
      "RENOUVELLEMENT DE PERIODE D'ESSAI\n\n" +
      "Entre les soussignes, {{company_name}}, situee {{company_address}}, SIRET {{company_siret}}, et {{employee_full_name}}.\n\n" +
      "Il est convenu de renouveler la periode d'essai du salarie au poste de {{employee_role}}.\n" +
      "Nouvelle periode: du {{start_date}} au {{end_date}}.\n\n" +
      "Le salarie reconnait avoir pris connaissance des conditions de ce renouvellement.\n\n" +
      "Fait a {{city}}, le {{today}}.\n\n" +
      "Signatures des parties.",
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
    content:
      "RUPTURE DE PERIODE D'ESSAI\n\n" +
      "{{company_name}}, situee au {{company_address}}, SIRET {{company_siret}}, notifie la rupture de la periode d'essai de {{employee_full_name}}.\n\n" +
      "Poste concerne: {{employee_role}}\n" +
      "Date de debut de contrat: {{start_date}}\n" +
      "Date de fin effective: {{end_date}}\n\n" +
      "Cette notification est remise au salarie conformement aux dispositions legales applicables.\n\n" +
      "Fait a {{city}}, le {{today}}.\n\n" +
      "Signature et cachet de l'employeur.",
  },
};

function fillTemplate(template, vars) {
  let out = String(template || "");
  Object.entries(vars || {}).forEach(([key, value]) => {
    out = out.replaceAll(`{{${key}}}`, value == null ? "" : String(value));
  });
  return out;
}

function todayFr() {
  return new Date().toLocaleDateString("fr-FR");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateFr(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  return v;
}

function MiniDocPreview({ template }) {
  const lines = [
    { w: "70%", h: 8, mb: 16, bold: true },
    { w: "90%", h: 5, mb: 6 },
    { w: "80%", h: 5, mb: 6 },
    { w: "85%", h: 5, mb: 16 },
    { w: "55%", h: 5, mb: 6 },
    { w: "60%", h: 5, mb: 6 },
    { w: "40%", h: 5, mb: 16 },
    { w: "75%", h: 5, mb: 6 },
    { w: "65%", h: 5, mb: 24 },
    { w: "45%", h: 5, mb: 0 },
  ];
  return (
    <div style={{
      background: "#fff",
      borderRadius: 6,
      padding: "14px 12px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 0,
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: template.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        marginBottom: 14,
      }}>{template.icon}</div>
      {lines.map((l, i) => (
        <div key={i} style={{
          width: l.w,
          height: l.h,
          borderRadius: 3,
          background: l.bold ? template.color : "#e8eaed",
          opacity: l.bold ? 0.85 : 1,
          marginBottom: l.mb,
        }} />
      ))}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: template.color, opacity: 0.5 }} />
        <div style={{ width: 24, height: 5, borderRadius: 3, background: "#e8eaed" }} />
      </div>
    </div>
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
    fullName: "",
    civility: "Monsieur",
    role: "",
    email: "",
    birthDate: "",
    nationality: "",
    homeAddress: "",
    homePostalCode: "",
    homeCity: "",
    school: "",
    startDate: "",
    endDate: "",
    totalHours: "",
  });
  const [issueMeta, setIssueMeta] = useState({ city: "", date: "" });
  const [todayValue, setTodayValue] = useState("");

  useEffect(() => {
    setTodayValue(todayIso());
  }, []);

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
    if (
      newEmployee.fullName ||
      newEmployee.role ||
      newEmployee.email ||
      newEmployee.birthDate ||
      newEmployee.nationality ||
      newEmployee.homeAddress ||
      newEmployee.homePostalCode ||
      newEmployee.homeCity ||
      newEmployee.school ||
      newEmployee.startDate ||
      newEmployee.endDate ||
      newEmployee.totalHours
    ) {
      return newEmployee;
    }
    return null;
  }, [selectedEmployee, newEmployee]);

  const docText = useMemo(() => {
    if (!selectedTemplate) return "";
    const employeeHomeAddress = [
      liveEmployee?.homeAddress || "",
      [liveEmployee?.homePostalCode || "", liveEmployee?.homeCity || ""].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
    const employeeDisplayName =
      `${liveEmployee?.civility || ""} ${liveEmployee?.fullName || ""}`.trim();
    const vars = {
      company_name: company.name || "___",
      company_siret: company.siret || "___",
      company_address: company.address || "___",
      city: issueMeta.city || "___",
      employee_display_name: employeeDisplayName || "___",
      employee_full_name: liveEmployee?.fullName || "___",
      employee_role: liveEmployee?.role || "___",
      employee_birth_date: liveEmployee?.birthDate || "___",
      employee_nationality: liveEmployee?.nationality || "___",
      employee_home_address: employeeHomeAddress || "___",
      employee_school: liveEmployee?.school || "___",
      start_date: liveEmployee?.startDate || "___",
      end_date: liveEmployee?.endDate || "___",
      stage_total_hours: liveEmployee?.totalHours || "___",
      today: issueMeta.date || "___",
    };
    return fillTemplate(selectedTemplate.content, vars);
  }, [company, issueMeta, liveEmployee, selectedTemplate]);

  const stageTemplateVars = useMemo(() => {
    const fullName = liveEmployee?.fullName || "";
    const civility = liveEmployee?.civility || "Monsieur";
    const displayName = `${civility} ${fullName}`.trim();
    const homeAddress = [
      liveEmployee?.homeAddress || "",
      [liveEmployee?.homePostalCode || "", liveEmployee?.homeCity || ""].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(" ");
    return {
      companyName: company.name || "___",
      companySiret: company.siret || "___",
      companyAddress: company.address || "___",
      employeeDisplayName: displayName || "___",
      employeeFullName: liveEmployee?.fullName || "___",
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

  const htmlPreview = useMemo(() => {
    if (!selectedTemplateId) return null;
    if (![
      "attestation-de-fin-stage-caplogy",
      "attestation-employeur-larissa",
      "renouvellement-periode-d-essai-test",
      "rupture-periode-d-essai",
    ].includes(selectedTemplateId)) {
      return null;
    }

    const pageShell = (title, body) => (
      <div style={{ padding: "30px 24px", background: "#fff", minHeight: "100%" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", color: "#111", fontFamily: "Arial, sans-serif", lineHeight: 1.28 }}>
          <div style={{ textAlign: "center", marginBottom: 18, fontWeight: 700, color: "#3f4a6b" }}>caplogy</div>
          <div style={{ border: "2px solid #111", textAlign: "center", fontWeight: 700, fontSize: 24, padding: "10px 12px", marginBottom: 24 }}>
            {title}
          </div>
          {body}
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 40, color: "#222", opacity: 0.9, marginBottom: 8 }}>CAPLOGY SAS</div>
          <div style={{ textAlign: "center", fontSize: 16, color: "#333" }}>
            36 Avenue de l'Europe<br />
            78140 Velizy-Villacoublay<br />
            RCS Versailles 893 395 608
          </div>
        </div>
      </div>
    );

    if (selectedTemplateId === "attestation-de-fin-stage-caplogy") {
      return pageShell("Attestation de fin de Stage", (
        <>
          <p style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>Organisme d'accueil</p>
          <p style={{ margin: "0 0 2px" }}>Nom ou denomination sociale: <b>{stageTemplateVars.companyName}</b></p>
          <p style={{ margin: "0 0 20px" }}>Adresse: {stageTemplateVars.companyAddress}</p>
          <p style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>Certifie que le Stagiaire</p>
          <p style={{ margin: "0 0 14px" }}>{stageTemplateVars.employeeDisplayName},</p>
          <p style={{ margin: "0 0 2px" }}>Ne(e) le {stageTemplateVars.birthDate}, de nationalite {stageTemplateVars.nationality},</p>
          <p style={{ margin: "0 0 14px" }}>Demeurant {stageTemplateVars.homeAddress},</p>
          <p style={{ margin: "0 0 20px" }}>Etudiant (e) a l'{stageTemplateVars.school}.</p>
          <p style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>Duree du stage</p>
          <p style={{ margin: "0 0 2px" }}>Date de debut et de fin de stage: du <b>{stageTemplateVars.startDate}</b> au <b>{stageTemplateVars.endDate}</b>,</p>
          <p style={{ margin: "0 0 20px" }}>Representant une duree totale de stage de {stageTemplateVars.totalHours} dans l'organisme d'accueil.</p>
          <p style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>Montant de la gratification verse au stagiaire</p>
          <p style={{ margin: "0 0 20px" }}>Le stagiaire n'a pas percu de gratification mensuelle de stage.</p>
          <p style={{ margin: "0 0 2px" }}>Fait a {stageTemplateVars.issueCity},</p>
          <p style={{ margin: "0 0 40px" }}>Le {stageTemplateVars.issueDate}.</p>
          <p style={{ textAlign: "center", margin: "0 0 2px" }}>Responsable des ressources humaines,</p>
          <p style={{ textAlign: "center", margin: "0 0 34px" }}>Larissa ABI ASSAF.</p>
        </>
      ));
    }

    if (selectedTemplateId === "attestation-employeur-larissa") {
      return pageShell("Attestation Employeur", (
        <>
          <p style={{ margin: "0 0 14px" }}>
            Je soussigne(e), {stageTemplateVars.companyName}, atteste que {stageTemplateVars.employeeDisplayName}
            {" "}est employe(e) au sein de notre entreprise.
          </p>
          <p style={{ margin: "0 0 2px" }}>Fonction: {stageTemplateVars.employeeRole}</p>
          <p style={{ margin: "0 0 2px" }}>Email: {stageTemplateVars.employeeEmail}</p>
          <p style={{ margin: "0 0 2px" }}>Periode: du {stageTemplateVars.startDate} au {stageTemplateVars.endDate}</p>
          <p style={{ margin: "0 0 20px" }}>SIRET: {stageTemplateVars.companySiret}</p>
          <p style={{ margin: "0 0 20px" }}>Cette attestation est delivree pour servir et valoir ce que de droit.</p>
          <p style={{ margin: "0 0 2px" }}>Fait a {stageTemplateVars.issueCity},</p>
          <p style={{ margin: "0 0 40px" }}>Le {stageTemplateVars.issueDate}.</p>
        </>
      ));
    }

    if (selectedTemplateId === "renouvellement-periode-d-essai-test") {
      return pageShell("Renouvellement de Periode d'Essai", (
        <>
          <p style={{ margin: "0 0 14px" }}>
            Entre les soussignes, {stageTemplateVars.companyName}, et {stageTemplateVars.employeeDisplayName}.
          </p>
          <p style={{ margin: "0 0 2px" }}>Poste: {stageTemplateVars.employeeRole}</p>
          <p style={{ margin: "0 0 2px" }}>Periode renouvellee: du {stageTemplateVars.startDate} au {stageTemplateVars.endDate}</p>
          <p style={{ margin: "0 0 20px" }}>Le salarie reconnait avoir pris connaissance des conditions de ce renouvellement.</p>
          <p style={{ margin: "0 0 2px" }}>Fait a {stageTemplateVars.issueCity},</p>
          <p style={{ margin: "0 0 40px" }}>Le {stageTemplateVars.issueDate}.</p>
          <p style={{ margin: "0 0 40px" }}>Signatures des parties.</p>
        </>
      ));
    }

    return pageShell("Rupture de Periode d'Essai", (
      <>
        <p style={{ margin: "0 0 14px" }}>
          {stageTemplateVars.companyName} notifie la rupture de la periode d'essai de {stageTemplateVars.employeeDisplayName}.
        </p>
        <p style={{ margin: "0 0 2px" }}>Poste concerne: {stageTemplateVars.employeeRole}</p>
        <p style={{ margin: "0 0 2px" }}>Date de debut: {stageTemplateVars.startDate}</p>
        <p style={{ margin: "0 0 20px" }}>Date de fin effective: {stageTemplateVars.endDate}</p>
        <p style={{ margin: "0 0 20px" }}>Notification remise conformement aux dispositions legales applicables.</p>
        <p style={{ margin: "0 0 2px" }}>Fait a {stageTemplateVars.issueCity},</p>
        <p style={{ margin: "0 0 40px" }}>Le {stageTemplateVars.issueDate}.</p>
      </>
    ));
  }, [selectedTemplateId, stageTemplateVars]);

  const pdfPreviewUrl = useMemo(() => {
    if (!selectedTemplateFile) return "";
    const employeeHomeAddress = [
      liveEmployee?.homeAddress || "",
      [liveEmployee?.homePostalCode || "", liveEmployee?.homeCity || ""].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
    const employeeDisplayName =
      `${liveEmployee?.civility || ""} ${liveEmployee?.fullName || ""}`.trim();
    const params = new URLSearchParams({
      name: selectedTemplateFile.name,
      company_name: company.name || "",
      company_siret: company.siret || "",
      company_address: company.address || "",
      city: issueMeta.city || "",
      employee_display_name: employeeDisplayName || "",
      employee_full_name: liveEmployee?.fullName || "",
      employee_role: liveEmployee?.role || "",
      employee_birth_date: liveEmployee?.birthDate || "",
      employee_nationality: liveEmployee?.nationality || "",
      employee_home_address: employeeHomeAddress || "",
      employee_school: liveEmployee?.school || "",
      start_date: liveEmployee?.startDate || "",
      end_date: liveEmployee?.endDate || "",
      stage_total_hours: liveEmployee?.totalHours || "",
      today: issueMeta.date || "",
      t: String(Date.now()),
    });
    return `/api/digitalisation-render?${params.toString()}#zoom=page-width`;
  }, [selectedTemplateFile, company, issueMeta, liveEmployee]);

  const handleAddEmployee = () => {
    if (!newEmployee.fullName.trim()) return;
    const employee = { id: Date.now().toString(), ...newEmployee };
    setEmployees((prev) => [...prev, employee]);
    setSelectedEmployeeId(employee.id);
    setNewEmployee({
      fullName: "",
      civility: "Monsieur",
      role: "",
      email: "",
      birthDate: "",
      nationality: "",
      homeAddress: "",
      homePostalCode: "",
      homeCity: "",
      school: "",
      startDate: "",
      endDate: "",
      totalHours: "",
    });
    setShowAddEmployee(false);
  };

  const handleDeleteEmployee = (id) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setSelectedEmployeeId((prev) => (prev === id ? "" : prev));
  };

  const handleEmployeeFieldChange = (field, value) => {
    setNewEmployee((prev) => ({ ...prev, [field]: value }));
    if (!selectedEmployeeId) return;
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === selectedEmployeeId ? { ...emp, [field]: value } : emp
      )
    );
  };

  const handleDownload = () => {
    const blob = new Blob([docText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate?.filename || "document"}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hoveredTemplate = hoveredTemplateId ? TEMPLATE_DEFINITIONS[hoveredTemplateId] : null;
  const previewTemplate = hoveredTemplate || selectedTemplate || Object.values(TEMPLATE_DEFINITIONS)[0];
  const hoveredTemplateFile = hoveredTemplateId ? templateFiles.find((f) => f.id === hoveredTemplateId) : null;
  const previewTemplateFile = hoveredTemplateFile || selectedTemplateFile || null;

  return (
      <div style={{ minHeight: "100vh", background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif", color: "#1a1a2e" }}>

        {/* Top Nav */}
        <nav style={{
          background: "#fff",
          borderBottom: "1px solid #eaecf0",
          padding: "0 32px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button type="button" onClick={() => (window.location.href = "/")} style={{
              background: "none",
              border: "1.5px solid #e2e8f0",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "#4b5563",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              ← Retour
            </button>
            <div style={{ width: 1, height: 24, background: "#e2e8f0" }} />
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1a1a2e", letterSpacing: "-0.3px" }}>
              Templates RH
            </span>
          </div>
          {designChosen && selectedTemplate && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#6366f1",
                background: "#f0f1ff",
                padding: "6px 14px",
                borderRadius: 20,
              }}>
                {selectedTemplate.icon} {selectedTemplate.title}
              </div>
              <button onClick={() => { setDesignChosen(false); }} style={{
                background: "none",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#6b7280",
                cursor: "pointer",
              }}>Changer</button>
            </div>
          )}
        </nav>

        {/* Template Picker Phase */}
        {!designChosen ? (
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px" }}>
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                Étape 1
              </p>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, fontWeight: 400, color: "#1a1a2e", marginBottom: 10, lineHeight: 1.15 }}>
                Choisissez votre template
              </h1>
              <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 520, lineHeight: 1.6 }}>
                Sélectionnez un modèle de document RH. Passez la souris pour avoir un aperçu, puis cliquez pour le choisir.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
              {/* Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {Object.values(TEMPLATE_DEFINITIONS).map((template) => {
                  const isSelected = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      className={`template-card${isSelected ? " selected" : ""}`}
                      style={{ "--card-color": template.color }}
                      onClick={() => setSelectedTemplateId(template.id)}
                      onMouseEnter={() => setHoveredTemplateId(template.id)}
                      onMouseLeave={() => setHoveredTemplateId(null)}
                    >
                      <div style={{
                        background: "#fff",
                        borderRadius: 14,
                        border: isSelected ? `2px solid ${template.color}` : "2px solid #eaecf0",
                        overflow: "hidden",
                        cursor: "pointer",
                        boxShadow: isSelected ? `0 8px 30px ${template.color}22` : "0 2px 8px rgba(0,0,0,0.05)",
                        textAlign: "left",
                      }}>
                        {/* Card top preview area */}
                        <div style={{
                          background: `linear-gradient(135deg, ${template.color}18 0%, ${template.accent}22 100%)`,
                          padding: "20px 20px 0",
                          height: 130,
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          position: "relative",
                          overflow: "hidden",
                        }}>
                          <div style={{ position: "absolute", top: 14, left: 14, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 18 }}>{template.icon}</span>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: template.color,
                              color: "#fff",
                              padding: "3px 10px",
                              borderRadius: 20,
                              letterSpacing: "0.3px",
                            }}>{template.category}</span>
                          </div>
                          {/* Mini lines representing a doc */}
                          <div style={{ width: "75%", paddingBottom: 0 }}>
                            {[80, 65, 90, 55, 70].map((w, i) => (
                              <div key={i} style={{
                                height: i === 0 ? 7 : 5,
                                width: `${w}%`,
                                background: i === 0 ? template.color : "#d1d5db",
                                borderRadius: 3,
                                marginBottom: 7,
                                opacity: i === 0 ? 0.8 : 0.7,
                              }} />
                            ))}
                          </div>
                        </div>

                        {/* Card info */}
                        <div style={{ padding: "16px 20px 18px" }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", marginBottom: 4, lineHeight: 1.3 }}>
                            {template.title}
                          </h3>
                          <p style={{ fontSize: 12.5, color: "#9ca3af", lineHeight: 1.5 }}>
                            {template.description}
                          </p>
                          {isSelected && (
                            <div style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 12,
                              fontWeight: 700,
                              color: template.color,
                              marginTop: 10,
                            }}>
                              <span style={{
                                width: 16,
                                height: 16,
                                background: template.color,
                                borderRadius: "50%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}>
                                <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>
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

              {/* Live Preview Panel */}
              <div style={{ position: "sticky", top: 80 }}>
                <div style={{
                  background: "#fff",
                  borderRadius: 18,
                  border: "1.5px solid #eaecf0",
                  overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                }}>
                  <div style={{
                    background: `linear-gradient(135deg, ${previewTemplate.color}14 0%, ${previewTemplate.accent}20 100%)`,
                    padding: "20px 24px",
                    borderBottom: "1px solid #eaecf0",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      background: previewTemplate.color,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}>{previewTemplate.icon}</div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: previewTemplate.color, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Aperçu</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{previewTemplate.title}</p>
                    </div>
                  </div>

                  <div style={{ padding: "20px 24px" }}>
                    <div style={{
                      background: "#f9fafb",
                      borderRadius: 10,
                      padding: "10px",
                      border: "1px solid #eaecf0",
                      minHeight: 260,
                    }}>
                      {previewTemplateFile ? (
                        <iframe
                          title="Template preview live"
                          src={`/api/digitalisation-template-file?name=${encodeURIComponent(previewTemplateFile.name)}#view=FitH&zoom=page-width`}
                          style={{
                            width: "100%",
                            height: "560px",
                            border: "none",
                            borderRadius: 8,
                            background: "#fff",
                          }}
                        />
                      ) : (
                        <div style={{
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          borderRadius: 8,
                          padding: "10px 12px",
                          color: "#9a3412",
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}>
                          Aucun fichier template correspondant trouve dans le dossier.
                        </div>
                      )}
                    </div>

                    <p style={{ fontSize: 12.5, color: "#6b7280", marginTop: 14, lineHeight: 1.6 }}>
                      {previewTemplate.description}
                    </p>
                  </div>

                  <div style={{ padding: "0 24px 24px" }}>
                    <button
                      className="choose-btn"
                      onClick={() => {
                        if (selectedTemplateId) setDesignChosen(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "13px",
                        background: selectedTemplateId ? `linear-gradient(135deg, ${previewTemplate.color} 0%, ${previewTemplate.color}cc 100%)` : "#e5e7eb",
                        color: selectedTemplateId ? "#fff" : "#9ca3af",
                        border: "none",
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: selectedTemplateId ? "pointer" : "not-allowed",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {selectedTemplateId ? `Utiliser ce template →` : "Sélectionnez un template"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* === Editor Phase === */
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
                      <span style={cardIconWrap("🏢")}>🏢</span>
                      <h3 style={cardTitle}>Entreprise</h3>
                    </div>
                    {loadingCompany && (
                      <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, background: "#f0f1ff", padding: "4px 10px", borderRadius: 20 }}>
                        Chargement...
                      </span>
                    )}
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
                      <span style={cardIconWrap("👤")}>👤</span>
                      <h3 style={cardTitle}>Salarié</h3>
                    </div>
                    <button onClick={() => setShowAddEmployee((v) => {
                      const next = !v;
                      if (next) setSelectedEmployeeId("");
                      return next;
                    })} style={{
                      background: showAddEmployee ? "#f5f6ff" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      color: showAddEmployee ? "#6366f1" : "#fff",
                      border: showAddEmployee ? "1.5px solid #e0e2f7" : "none",
                      borderRadius: 9,
                      padding: "7px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}>
                      {showAddEmployee ? "Annuler" : "+ Ajouter"}
                    </button>
                  </div>

                  {employees.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: showAddEmployee ? 16 : 0 }}>
                      {employees.map((emp) => (
                        <div
                          key={emp.id}
                          className="emp-row"
                          onClick={() => setSelectedEmployeeId(emp.id)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: `1.5px solid ${selectedEmployeeId === emp.id ? "#6366f1" : "#eaecf0"}`,
                            background: selectedEmployeeId === emp.id ? "#f5f6ff" : "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: selectedEmployeeId === emp.id ? "#6366f1" : "#e5e7eb",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 800,
                              color: selectedEmployeeId === emp.id ? "#fff" : "#6b7280",
                            }}>
                              {emp.fullName[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e" }}>{emp.fullName}</div>
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>{emp.role || "—"}</div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.id); }}
                            style={{ background: "none", border: "none", color: "#d1d5db", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showAddEmployee && (
                    <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16, border: "1.5px solid #eaecf0" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Nom complet *</label>
                          <input
                            type="text"
                            value={selectedEmployeeId ? (selectedEmployee?.fullName || "") : newEmployee.fullName}
                            onChange={(e) => handleEmployeeFieldChange("fullName", e.target.value)}
                            style={inputStyle}
                            placeholder="Jean Dupont"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Civilité</label>
                          <select
                            value={selectedEmployeeId ? (selectedEmployee?.civility || "Monsieur") : newEmployee.civility}
                            onChange={(e) => handleEmployeeFieldChange("civility", e.target.value)}
                            style={inputStyle}
                          >
                            <option value="Monsieur">Monsieur</option>
                            <option value="Madame">Madame</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Email</label>
                          <input
                            type="email"
                            value={selectedEmployeeId ? (selectedEmployee?.email || "") : newEmployee.email}
                            onChange={(e) => handleEmployeeFieldChange("email", e.target.value)}
                            style={inputStyle}
                            placeholder="jean.dupont@email.com"
                          />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Fonction</label>
                          <input type="text" value={selectedEmployeeId ? (selectedEmployee?.role || "") : newEmployee.role} onChange={(e) => handleEmployeeFieldChange("role", e.target.value)} style={inputStyle} placeholder="Développeur Frontend" />
                        </div>
                        <div>
                          <label style={labelStyle}>Date de naissance</label>
                          <input
                            type="date"
                            value={selectedEmployeeId ? (selectedEmployee?.birthDate || "") : newEmployee.birthDate}
                            onChange={(e) => handleEmployeeFieldChange("birthDate", e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Nationalité</label>
                          <input
                            type="text"
                            value={selectedEmployeeId ? (selectedEmployee?.nationality || "") : newEmployee.nationality}
                            onChange={(e) => handleEmployeeFieldChange("nationality", e.target.value)}
                            style={inputStyle}
                            placeholder="Française"
                          />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Adresse personnelle</label>
                          <input
                            type="text"
                            value={selectedEmployeeId ? (selectedEmployee?.homeAddress || "") : newEmployee.homeAddress}
                            onChange={(e) => handleEmployeeFieldChange("homeAddress", e.target.value)}
                            style={inputStyle}
                            placeholder="10 rue Victor Hugo, 75011 Paris"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Code postal</label>
                          <input
                            type="text"
                            value={selectedEmployeeId ? (selectedEmployee?.homePostalCode || "") : newEmployee.homePostalCode}
                            onChange={(e) => handleEmployeeFieldChange("homePostalCode", e.target.value)}
                            style={inputStyle}
                            placeholder="75011"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Ville</label>
                          <input
                            type="text"
                            value={selectedEmployeeId ? (selectedEmployee?.homeCity || "") : newEmployee.homeCity}
                            onChange={(e) => handleEmployeeFieldChange("homeCity", e.target.value)}
                            style={inputStyle}
                            placeholder="Paris"
                          />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Etablissement</label>
                          <input
                            type="text"
                            value={selectedEmployeeId ? (selectedEmployee?.school || "") : newEmployee.school}
                            onChange={(e) => handleEmployeeFieldChange("school", e.target.value)}
                            style={inputStyle}
                            placeholder="Nom de l'école / organisme"
                          />
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
                          <label style={labelStyle}>Durée totale du stage (heures)</label>
                          <input
                            type="text"
                            value={selectedEmployeeId ? (selectedEmployee?.totalHours || "") : newEmployee.totalHours}
                            onChange={(e) => handleEmployeeFieldChange("totalHours", e.target.value)}
                            style={inputStyle}
                            placeholder="Ex: 140"
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                        <button onClick={() => setShowAddEmployee(false)} style={{
                          flex: 1, background: "#fff", color: "#6b7280", border: "1.5px solid #e2e8f0",
                          borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}>Annuler</button>
                        <button onClick={handleAddEmployee} style={{
                          flex: 1, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                          color: "#fff", border: "none", borderRadius: 9, padding: "10px",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}>Enregistrer</button>
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
                      <span style={cardIconWrap("📝")}>📝</span>
                      <h3 style={cardTitle}>Document</h3>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Fait à</label>
                      <input
                        type="text"
                        value={issueMeta.city}
                        onChange={(e) => setIssueMeta((prev) => ({ ...prev, city: e.target.value }))}
                        style={inputStyle}
                        placeholder="Ville de signature"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Fait le</label>
                      <input
                        type="date"
                        value={issueMeta.date}
                        onChange={(e) => setIssueMeta((prev) => ({ ...prev, date: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <button className="action-btn" onClick={handleDownload} style={{
                    background: "#fff",
                    color: "#374151",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "14px",
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                    ⬇ Télécharger
                  </button>
                  <button className="action-btn" style={{
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding: "14px",
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
                  }}>
                    ✉ Envoyer
                  </button>
                </div>
              </div>

              {/* Right Preview */}
              <div style={{ position: "sticky", top: 80 }}>
                <div style={{
                  width: "100%",
                  minHeight: 920,
                  background: "#fff",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.08)",
                  padding: 0,
                  overflow: "hidden",
                }}>
                  {htmlPreview ? (
                    htmlPreview
                  ) : selectedTemplateFile ? (
                    <iframe
                      title="Template file preview"
                      src={pdfPreviewUrl}
                      style={{ width: "100%", height: "1020px", border: "none", background: "#fff" }}
                    />
                  ) : (
                    <pre style={{
                      fontFamily: "'Georgia', 'Times New Roman', serif",
                      fontSize: 16,
                      lineHeight: 1.85,
                      color: "#111827",
                      whiteSpace: "pre-wrap",
                      margin: 0,
                      padding: "44px 54px",
                    }}>{docText}</pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

const card = {
  background: "#fff",
  borderRadius: 16,
  padding: "22px 24px",
  border: "1.5px solid #eaecf0",
  boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const cardIconWrap = () => ({
  width: 32,
  height: 32,
  background: "#f5f6ff",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
});

const cardTitle = {
  fontSize: 15,
  fontWeight: 700,
  color: "#1a1a2e",
  margin: 0,
};

const labelStyle = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 6,
  letterSpacing: "0.1px",
};

const inputStyle = {
  width: "100%",
  border: "1.5px solid #e5e7eb",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 13.5,
  color: "#1a1a2e",
  background: "#fff",
  fontFamily: "'DM Sans', sans-serif",
  transition: "border-color 0.15s, box-shadow 0.15s",
};
