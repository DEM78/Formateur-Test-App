// components/formateur/Step4Contract.jsx
import { useState, useEffect, useRef } from "react";

export default function Step4Contract({ formData, setStep, onFinalSubmit }) {
  const [employerChoice, setEmployerChoice] = useState("caplogy");
  const [employer, setEmployer] = useState({
    denomination: "Caplogy",
    siren: "",
    siret: "",
    adresse: "",
    forme_juridique: "",
    capital: "",
    rcs: "",
    representant: "",
    fonction_representant: "Gérant",
  });

  const [prestataire, setPrestataire] = useState({
    nom: formData.nom || "",
    prenom: formData.prenom || "",
    email: formData.email || "",
    telephone: formData.telephone || "",
    denomination: "",
    siren: "",
    siret: "",
    rcs: "",
    adresse: formData.adresse || "",
    code_postal: "",
    ville: "",
    representant: `${formData.prenom} ${formData.nom}`.trim(),
    fonction_representant: "",
  });

  const [variables, setVariables] = useState({
    date_signature: new Date().toISOString().split("T")[0],
    lieu_signature: "Paris",
  });

  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const [loadingEmployer, setLoadingEmployer] = useState(false);
  const [loadingPrestataire, setLoadingPrestataire] = useState(false);
  const [générétingContract, setGeneratingContract] = useState(false);

  // ✅ Petit état d’erreur lisible (au lieu de crash)
  const [apiWarning, setApiWarning] = useState("");
  const [extractStatus, setExtractStatus] = useState("idle");

  useEffect(() => {
    autoFillEmployer(employerChoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerChoice]);


  useEffect(() => {
    autoExtractPrestataire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = 520;
    const height = 160;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, []);

  // ✅ Fetch JSON SAFE (si HTML -> message clair)
  const fetchJsonSafe = async (url, options) => {
    const res = await fetch(url, options);
    const raw = await res.text();
    const trimmed = (raw || "").trim();

    if (trimmed.startsWith("<")) {
      // HTML (404/500) => ne pas planter
      throw new Error(
        `API a renvoyé du HTML au lieu de JSON.\nURL: ${url}\nStatus: ${res.status}\nExtrait: ${trimmed
          .slice(0, 120)
          .replace(/\s+/g, " ")}...`
      );
    }

    let data = {};
    try {
      data = trimmed ?JSON.parse(trimmed) : {};
    } catch (e) {
      throw new Error(
        `Réponse JSON invalide.\nURL: ${url}\nStatus: ${res.status}\nRaw: ${trimmed.slice(0, 200)}...`
      );
    }

    if (!res.ok) {
      throw new Error(data?.error || `Erreur API ${res.status}`);
    }

    return data;
  };

  const autoFillEmployer = async (choice) => {
    setExtractStatus("loading_employer");
    setLoadingEmployer(true);
    setApiWarning("");

    try {
      const data = await fetchJsonSafe(`/api/employer?company=${choice}`);

      if (data?.employer) {
        setExtractStatus("employer_ok");
        setEmployer((prev) => ({
          ...prev,
          ...data.employer,
        }));
      }
    } catch (err) {
      setExtractStatus("employer_error");
      console.warn("autoFillEmployer fallback:", err?.message || err);
      setApiWarning(
        "?Auto-remplissage employeur indisponible (route /api/employer absente ou erreur). Remplissez manuellement si besoin."
      );
    } finally {
      setLoadingEmployer(false);
    }
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const mergePreferNonEmpty = (base, override) => {
    const result = { ...(base || {}) };
    const src = override || {};
    for (const key of Object.keys(src)) {
      const v = src[key];
      if (v != null && String(v).trim() !== "") {
        result[key] = v;
      }
    }
    return result;
  };


  const autoExtractPrestataire = async () => {
    setExtractStatus("loading_prestataire");
    setLoadingPrestataire(true);
    setApiWarning("");

    try {
      const documents = [];
      const docTypes = ["kbis", "urssaf", "fiscale", "recpActivite", "assurance"];

      for (const type of docTypes) {
        const file = formData[type];
        if (file) {
          const base64 = await fileToBase64(file);
          documents.push({ type, fileBase64: base64 });
        }
      }

      if (documents.length === 0) {
        setExtractStatus("no_docs");
        setLoadingPrestataire(false);
        return;
      }

      // API extraction contrat
      const data = await fetchJsonSafe("/api/extract-contrat-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents,
          nom: formData.nom,
          prenom: formData.prenom,
        }),
      });

      if (data?.prestataire) {
        setExtractStatus("prestataire_ok");
        setPrestataire((prev) => {
          const merged = mergePreferNonEmpty(prev, data.prestataire);
          return {
            ...merged,
            // Toujours prioriser l'adresse du CV si disponible
            adresse: formData.adresse || merged.adresse || "",
          };
        });
      }
    } catch (err) {
      setExtractStatus("prestataire_error");
      setExtractStatus("employer_error");
      console.warn("Erreur auto-extract prestataire:", err?.message || err);
      setApiWarning(
        "⚠️ Auto-extraction prestataire indisponible (route /api/extract-contrat-fields introuvable ou erreur). Remplissez manuellement si besoin."
      );
    } finally {
      setLoadingPrestataire(false);
    }
  };

  const handleGenerateContract = () => {
    try {
      const prestataireForContract = {
        ...prestataire,
        email: prestataire.email || formData.email || "",
        telephone: prestataire.telephone || formData.telephone || "",
      };
      const payload = {
        employer,
        prestataire: prestataireForContract,
        variables: { ...variables },
      };
      localStorage.setItem("caplogy_contract_payload", JSON.stringify(payload));
      localStorage.setItem("caplogy_force_step", "4");
      window.location.href = "/contrat";
    } catch (err) {
      console.error("Erreur préparation contrat:", err);
      setApiWarning(err?.message || "Erreur lors de la préparation du contrat");
      alert("❌ Erreur lors de la préparation du contrat");
    }
  };

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches && e.touches[0];
    const clientX = touch ?touch.clientX : e.clientX;
    const clientY = touch ?touch.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    lastPointRef.current = getPoint(e);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };

  const endDraw = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL("image/png"));
    setSignatureConfirmed(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 520, 160);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    setSignatureDataUrl("");
  };

  const formatDateFr = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("fr-FR");
  };

  const handleFinalSubmit = () => {
    onFinalSubmit?.({
      ...formData,
      contrat: { employer, prestataire, variables: { ...variables, signature_data_url: signatureDataUrl, signature_confirmed: signatureConfirmed } },
    });
  };

  const inputStyle = {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "2px solid #e5e7eb",
    backgroundColor: "#fff",
    color: "#111",
    fontSize: "14px",
    width: "100%",
    outline: "none",
    transition: "all 0.2s",
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "60px auto",
        padding: "50px 40px",
        borderRadius: "24px",
        backgroundColor: "#fff",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "32px", fontWeight: "800", color: "#111", marginBottom: "12px" }}>
          Génération du contrat
        </h2>
        <p style={{ color: "#6b7280", fontSize: "16px" }}>
          Vérifiez et complètez les informations pour générér votre contrat de prestation
        </p>

        {extractStatus !== "idle" && (
          <div
            style={{
              marginTop: "12px",
              backgroundColor: "#eef2ff",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              color: "#1e3a8a",
              fontWeight: "600",
              borderLeft: "4px solid #3b82f6",
              whiteSpace: "pre-line",
            }}
          >
            Statut extraction : {extractStatus}
          </div>
        )}
                {apiWarning && (
          <div
            style={{
              marginTop: "16px",
              backgroundColor: "#fef3c7",
              padding: "14px 16px",
              borderRadius: "12px",
              fontSize: "14px",
              color: "#92400e",
              fontWeight: "600",
              borderLeft: "4px solid #f59e0b",
              whiteSpace: "pre-line",
            }}
          >
            {apiWarning}
          </div>
        )}
      </div>
      {/* Section Employeur */}
      <div style={{ marginBottom: "40px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#111", marginBottom: "20px" }}>
          L'EMPLOYEUR {loadingEmployer && <span style={{ fontSize: "14px", color: "#3b82f6" }}>?Chargement...</span>}
        </h3>

        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
            Choix de l'employeur
          </label>
          <select
            value={employerChoice}
            onChange={(e) => setEmployerChoice(e.target.value)}
            style={{ ...inputStyle, maxWidth: "320px" }}
          >
            <option value="caplogy">Caplogy</option>
            <option value="novatiel">Novatiel</option>
            <option value="doctrina">Doctrina</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Dénomination sociale *
            </label>
            <input
              type="text"
              value={employer.denomination}
              onChange={(e) => setEmployer({ ...employer, denomination: e.target.value })}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              SIREN *
            </label>
            <input
              type="text"
              value={employer.siren}
              onChange={(e) => setEmployer({ ...employer, siren: e.target.value })}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              SIRET *
            </label>
            <input
              type="text"
              value={employer.siret}
              onChange={(e) => setEmployer({ ...employer, siret: e.target.value })}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Adresse complète *
            </label>
            <input
              type="text"
              value={employer.adresse}
              onChange={(e) => setEmployer({ ...employer, adresse: e.target.value })}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Représentant légal *
            </label>
            <input
              type="text"
              value={employer.representant}
              onChange={(e) => setEmployer({ ...employer, representant: e.target.value })}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Fonction *
            </label>
            <input
              type="text"
              value={employer.fonction_representant}
              onChange={(e) => setEmployer({ ...employer, fonction_representant: e.target.value })}
              style={inputStyle}
              required
            />
          </div>
        </div>
      </div>

      {/* Section Prestataire */}
      <div style={{ marginBottom: "40px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#111", marginBottom: "20px" }}>
          LE PRESTATAIRE (VOUS){" "}
          {loadingPrestataire && <span style={{ fontSize: "14px", color: "#3b82f6" }}>🔄 Extraction...</span>}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Dénomination (si société)
            </label>
            <input
              type="text"
              value={prestataire.denomination}
              onChange={(e) => setPrestataire({ ...prestataire, denomination: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              SIREN
            </label>
            <input
              type="text"
              value={prestataire.siren}
              onChange={(e) => setPrestataire({ ...prestataire, siren: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Adresse professionnelle *
            </label>
            <input
              type="text"
              value={prestataire.adresse}
              onChange={(e) => setPrestataire({ ...prestataire, adresse: e.target.value })}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Représentant
            </label>
            <input
              type="text"
              value={prestataire.representant}
              onChange={(e) => setPrestataire({ ...prestataire, representant: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Variables */}
      <div style={{ marginBottom: "40px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#111", marginBottom: "20px" }}>
          SIGNATURE ET LIEU
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Lieu signature
            </label>
            <input
              type="text"
              value={variables.lieu_signature}
              onChange={(e) => setVariables({ ...variables, lieu_signature: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Date signature
            </label>
            <input
              type="date"
              value={variables.date_signature}
              onChange={(e) => setVariables({ ...variables, date_signature: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div
        style={{
          marginBottom: "40px",
          padding: "28px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "16px 18px",
            borderRadius: "14px",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            marginBottom: "22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/Logo_caplogy_contrat.png" alt="Caplogy" style={{ height: "38px", width: "auto" }} />
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", letterSpacing: "0.3px" }}>
                CONTRAT DE PRESTATION DE SERVICES
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px" }}>
                Aperçu non contractuel - le PDF sera généréavec les informations ci-dessous
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: "700",
              letterSpacing: "0.4px",
              color: "#ffffff",
              background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
            }}
          >
            VERSION PREVIEW
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontWeight: "700", color: "#0f172a", marginBottom: "8px" }}>Entre les soussignés :</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px" }}>
              <div style={{ fontWeight: "800", marginBottom: "10px", color: "#0f172a" }}>L'Employeur</div>
              <div style={{ color: "#111827" }}><strong>Dénomination :</strong> {employer.denomination || "-"}</div>
              <div style={{ color: "#111827" }}><strong>SIREN :</strong> {employer.siren || "-"}</div>
              <div style={{ color: "#111827" }}><strong>SIRET :</strong> {employer.siret || "-"}</div>
              <div style={{ color: "#111827" }}><strong>Adresse :</strong> {employer.adresse || "-"}</div>
              <div style={{ color: "#111827" }}><strong>Représentant :</strong> {employer.representant || "-"}</div>
              <div style={{ color: "#111827" }}><strong>Fonction :</strong> {employer.fonction_representant || "-"}</div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px" }}>
              <div style={{ fontWeight: "800", marginBottom: "10px", color: "#0f172a" }}>Le Prestataire</div>
            <div style={{ color: "#111827" }}><strong>Dénomination :</strong> {prestataire.denomination || "-"}</div>
            <div style={{ color: "#111827" }}><strong>SIREN :</strong> {prestataire.siren || "-"}</div>
            <div style={{ color: "#111827" }}><strong>Adresse :</strong> {prestataire.adresse || "-"}</div>
            <div style={{ color: "#111827" }}><strong>Email :</strong> {prestataire.email || "-"}</div>
            <div style={{ color: "#111827" }}><strong>Téléphone :</strong> {prestataire.telephone || "-"}</div>
            <div style={{ color: "#111827" }}><strong>Représentant :</strong> {prestataire.representant || "-"}</div>
          </div>
        </div>
        </div>

        <div style={{ fontSize: "13px", color: "#475569" }}>
          Fait à{variables.lieu_signature || "-"}, le {formatDateFr(variables.date_signature) || "-"}
        </div>
      </div>
      {/* Buttons */}
      <div style={{ display: "flex", gap: "16px", marginTop: "40px" }}>
        <button
          type="button"
          onClick={() => setStep(3)}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "12px",
            border: "2px solid #e5e7eb",
            backgroundColor: "#fff",
            color: "#111",
            fontWeight: "700",
            fontSize: "16px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#111";
            e.currentTarget.style.backgroundColor = "#f9fafb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e5e7eb";
            e.currentTarget.style.backgroundColor = "#fff";
          }}
        >
          ← Retour
        </button>

        <button
          type="button"
          onClick={handleGenerateContract}
          disabled={générétingContract}
          style={{
            flex: 2,
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: générétingContract ?"#9ca3af" : "#3b82f6",
            color: "#fff",
            fontWeight: "700",
            fontSize: "16px",
            cursor: générétingContract ?"not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!générétingContract) e.currentTarget.style.backgroundColor = "#2563eb";
          }}
          onMouseLeave={(e) => {
            if (!générétingContract) e.currentTarget.style.backgroundColor = "#3b82f6";
          }}
        >
          {générétingContract ?"⏳ Génération..." : "📄 Générer & Télécharger le Contrat"}
        </button>

        <button
          type="button"
          onClick={handleFinalSubmit}
          style={{
            flex: 2,
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#10b981",
            color: "#fff",
            fontWeight: "700",
            fontSize: "16px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#059669";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 10px 25px rgba(16,185,129,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#10b981";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Soumettre le dossier complet ✓
        </button>
      </div>
    </div>
  );
}

