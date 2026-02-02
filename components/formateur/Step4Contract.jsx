// components/formateur/Step4Contract.jsx
import { useState, useEffect } from "react";

export default function Step4Contract({ formData, setStep, onFinalSubmit }) {
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
    taux_journalier: "",
    duree_mission: "",
    date_debut: "",
    date_fin: "",
  });

  const [loadingEmployer, setLoadingEmployer] = useState(false);
  const [loadingPrestataire, setLoadingPrestataire] = useState(false);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractPreview, setContractPreview] = useState("");

  // ✅ Petit état d’erreur lisible (au lieu de crash)
  const [apiWarning, setApiWarning] = useState("");

  useEffect(() => {
    autoFillCaplogy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    autoExtractPrestataire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      data = trimmed ? JSON.parse(trimmed) : {};
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

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const autoFillCaplogy = async () => {
    setLoadingEmployer(true);
    setApiWarning("");

    try {
      // ✅ Si tu n’as pas /api/employer, on ne plante pas.
      // Tu as mis dans l’arbo “extract-contrat-fields.js” etc, mais pas employer.js.
      // Donc on tente, et si ça 404 => fallback.
      const data = await fetchJsonSafe("/api/employer?query=caplogy");

      if (data?.employer) {
        setEmployer((prev) => ({
          ...prev,
          ...data.employer,
        }));
      }
    } catch (err) {
      console.warn("autoFillCaplogy fallback:", err?.message || err);
      setApiWarning(
        "⚠️ Auto-remplissage employeur indisponible (route /api/employer absente ou erreur). Remplissez manuellement si besoin."
      );
      // fallback déjà dans state (denomination = Caplogy)
    } finally {
      setLoadingEmployer(false);
    }
  };

  const autoExtractPrestataire = async () => {
    setLoadingPrestataire(true);
    setApiWarning("");

    try {
      const documents = [];
      const docTypes = ["kbis", "urssaf", "fiscale", "recpActivite"];

      for (const type of docTypes) {
        const file = formData[type];
        if (file) {
          const base64 = await fileToBase64(file);
          documents.push({ type, fileBase64: base64 });
        }
      }

      if (documents.length === 0) {
        setLoadingPrestataire(false);
        return;
      }

      // ✅ IMPORTANT: ton fichier est "extract-contrat-fields.js"
      // donc l'URL doit être "/api/extract-contrat-fields"
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
        setPrestataire((prev) => ({
          ...prev,
          ...data.prestataire,
        }));
      }
    } catch (err) {
      console.warn("Erreur auto-extract prestataire:", err?.message || err);
      setApiWarning(
        "⚠️ Auto-extraction prestataire indisponible (route /api/extract-contrat-fields introuvable ou erreur). Remplissez manuellement si besoin."
      );
    } finally {
      setLoadingPrestataire(false);
    }
  };

  const handleGenerateContract = async () => {
    setGeneratingContract(true);
    setApiWarning("");

    try {
      const res = await fetch("/api/generate-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employer, prestataire, variables }),
      });

      // ✅ si erreur, lire texte pour debug (souvent HTML)
      if (!res.ok) {
        const raw = await res.text();
        const trimmed = (raw || "").trim();
        if (trimmed.startsWith("<")) {
          throw new Error(
            `Erreur API (HTML reçu).\nURL: /api/generate-contract\nStatus: ${res.status}\nExtrait: ${trimmed
              .slice(0, 140)
              .replace(/\s+/g, " ")}...`
          );
        }
        // si JSON
        try {
          const j = JSON.parse(trimmed || "{}");
          throw new Error(j?.error || "Erreur génération contrat");
        } catch {
          throw new Error("Erreur génération contrat");
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrat_${(prestataire.nom || "Prestataire")}_${(employer.denomination || "Employeur")}.odt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      generatePreview();
    } catch (err) {
      console.error("Erreur génération:", err);
      setApiWarning(err?.message || "Erreur lors de la génération du contrat");
      alert("❌ Erreur lors de la génération du contrat");
    } finally {
      setGeneratingContract(false);
    }
  };

  const generatePreview = () => {
    const preview = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h2 style="text-align: center;">CONTRAT DE PRESTATION DE SERVICES</h2>

        <h3>Entre les soussignés :</h3>

        <div style="margin: 20px 0;">
          <h4>L'EMPLOYEUR :</h4>
          <p><strong>Dénomination :</strong> ${employer.denomination || ""}</p>
          <p><strong>SIREN :</strong> ${employer.siren || ""}</p>
          <p><strong>Adresse :</strong> ${employer.adresse || ""}</p>
          <p><strong>Représenté par :</strong> ${employer.representant || ""}, ${employer.fonction_representant || ""}</p>
        </div>

        <div style="margin: 20px 0;">
          <h4>LE PRESTATAIRE :</h4>
          <p><strong>Nom :</strong> ${(prestataire.nom || "") + " " + (prestataire.prenom || "")}</p>
          <p><strong>SIREN :</strong> ${prestataire.siren || ""}</p>
          <p><strong>Adresse :</strong> ${prestataire.adresse || ""}</p>
        </div>

        <div style="margin: 20px 0;">
          <h4>Modalités :</h4>
          <p><strong>Taux journalier :</strong> ${variables.taux_journalier || ""} €</p>
          <p><strong>Période :</strong> ${variables.date_debut || ""} au ${variables.date_fin || ""}</p>
        </div>

        <div style="margin-top: 40px;">
          <p>Fait à ${variables.lieu_signature || ""}, le ${variables.date_signature || ""}</p>
        </div>
      </div>
    `;
    setContractPreview(preview);
  };

  const handleFinalSubmit = () => {
    onFinalSubmit?.({
      ...formData,
      contrat: { employer, prestataire, variables },
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
          Vérifiez et complétez les informations pour générer votre contrat de prestation
        </p>

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
          L'EMPLOYEUR{" "}
          {loadingEmployer && <span style={{ fontSize: "14px", color: "#3b82f6" }}>🔄 Chargement...</span>}
        </h3>

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
              SIREN
            </label>
            <input
              type="text"
              value={prestataire.siren}
              onChange={(e) => setPrestataire({ ...prestataire, siren: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              SIRET
            </label>
            <input
              type="text"
              value={prestataire.siret}
              onChange={(e) => setPrestataire({ ...prestataire, siret: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
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
        </div>
      </div>

      {/* Variables */}
      <div style={{ marginBottom: "40px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#111", marginBottom: "20px" }}>
          MODALITÉS DE LA PRESTATION
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Taux journalier (€)
            </label>
            <input
              type="number"
              value={variables.taux_journalier}
              onChange={(e) => setVariables({ ...variables, taux_journalier: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Durée mission (jours)
            </label>
            <input
              type="text"
              value={variables.duree_mission}
              onChange={(e) => setVariables({ ...variables, duree_mission: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Date début
            </label>
            <input
              type="date"
              value={variables.date_debut}
              onChange={(e) => setVariables({ ...variables, date_debut: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Date fin
            </label>
            <input
              type="date"
              value={variables.date_fin}
              onChange={(e) => setVariables({ ...variables, date_fin: e.target.value })}
              style={inputStyle}
            />
          </div>

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
      {contractPreview && (
        <div
          style={{
            marginBottom: "40px",
            padding: "30px",
            backgroundColor: "#f9fafb",
            borderRadius: "12px",
            border: "2px solid #e5e7eb",
          }}
          dangerouslySetInnerHTML={{ __html: contractPreview }}
        />
      )}

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
          disabled={generatingContract}
          style={{
            flex: 2,
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: generatingContract ? "#9ca3af" : "#3b82f6",
            color: "#fff",
            fontWeight: "700",
            fontSize: "16px",
            cursor: generatingContract ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!generatingContract) e.currentTarget.style.backgroundColor = "#2563eb";
          }}
          onMouseLeave={(e) => {
            if (!generatingContract) e.currentTarget.style.backgroundColor = "#3b82f6";
          }}
        >
          {generatingContract ? "⏳ Génération..." : "📄 Générer & Télécharger le Contrat"}
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
