// components/formateur/FormateurFormView.jsx
import { useMemo, useState } from "react";
import Step4Contract from "./Step4Contract";

export default function FormateurFormView({
  step,
  setStep,
  formData,
  updateField,
  loadingCV,
  cvError,
  verifyingIdentity,
  identityMessage,
  verifyingDocs,
  docStatus,
  docMessage,
  handleFileChange,
  handleSubmit,
  getDocIcon,
  onSubmitForm,
  clearDraft,
}) {
  // Styles
  const inputStyle = {
    padding: "14px 18px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    backgroundColor: "#fff",
    color: "#111",
    fontSize: "15px",
    width: "100%",
    outline: "none",
    transition: "all 0.2s",
    fontFamily: "inherit",
  };

  const FileInput = ({ label, name, accept, required }) => {
    const file = formData[name];
    const isIdentity = name === "identite";
    const isOtherDoc = !isIdentity && name !== "cv";

    return (
      <div
        style={{
          backgroundColor: "#f9fafb",
          padding: "20px",
          borderRadius: "12px",
          border: "2px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom:
              (isIdentity && file) ||
              (isOtherDoc && file && (docMessage[name] || verifyingDocs[name]))
                ? "12px"
                : "0",
          }}
        >
          <span style={{ fontWeight: 600, color: "#111", fontSize: "15px" }}>
            {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* ✅ Identité : inchangé */}
            {isIdentity && file && (
              <span
                style={{
                  fontSize: "20px",
                  animation: verifyingIdentity ? "pulse 1.5s infinite" : "none",
                }}
              >
                {verifyingIdentity
                  ? "⏳"
                  : formData.identiteValid === true
                  ? "✅"
                  : formData.identiteValid === false
                  ? "❌"
                  : "⏳"}
              </span>
            )}

            {/* ✅ Autres docs */}
            {isOtherDoc && file && (
              <span
                className={docStatus[name] === "OK" && !verifyingDocs[name] ? "doc-ok" : ""}
                style={{
                  fontSize: "20px",
                  animation: verifyingDocs[name] ? "pulse 1.5s infinite" : "none",
                }}
              >
                {getDocIcon(name) || "⏳"}
              </span>
            )}

            <span
              style={{
                fontSize: "14px",
                color: "#6b7280",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file ? file.name : "Aucun fichier"}
            </span>

            <input
              type="file"
              id={name}
              name={name}
              accept={accept}
              onChange={handleFileChange}
              // ✅ IMPORTANT: PAS de required ici sinon submit silencieusement bloqué
              style={{ display: "none" }}
            />

            <label
              htmlFor={name}
              style={{
                backgroundColor: "#111",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "14px",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                opacity: verifyingIdentity || verifyingDocs[name] ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#3b82f6";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#111";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Choisir
            </label>
          </div>
        </div>

        {/* Identité : message inchangé */}
        {isIdentity && identityMessage && (
          <div
            style={{
              fontSize: "13px",
              color: identityMessage.includes("✅")
                ? "#059669"
                : identityMessage.includes("🔄")
                ? "#3b82f6"
                : identityMessage.includes("⚠️")
                ? "#92400e"
                : "#ef4444",
              fontWeight: 500,
              marginTop: "8px",
            }}
          >
            {identityMessage}
          </div>
        )}

        {/* Autres docs : message */}
        {isOtherDoc && file && (docMessage[name] || verifyingDocs[name]) && (
          <div
            style={{
              fontSize: "13px",
              color:
                docStatus[name] === "OK"
                  ? "#059669"
                  : docStatus[name] === "FAIL"
                  ? "#ef4444"
                  : verifyingDocs[name]
                  ? "#3b82f6"
                  : "#92400e",
              fontWeight: 500,
              marginTop: "8px",
            }}
          >
            {docMessage[name] || (verifyingDocs[name] ? "🔄 Vérification en cours..." : "")}
          </div>
        )}
      </div>
    );
  };

  // ✅ Compétences
  const skillsList = useMemo(() => {
    const skills = Array.isArray(formData.skills) ? formData.skills : [];
    const cleaned = skills.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
    return Array.from(new Set(cleaned));
  }, [formData.skills]);

  const [newSkill, setNewSkill] = useState("");

  const normalizeSkill = (skill) => {
    return (skill || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9+#.\s-]/g, "")
      .trim();
  };

  const addSkill = () => {
    const s = normalizeSkill(newSkill);
    if (!s) return;
    const next = Array.from(new Set([...skillsList, s]));
    updateField("skills", next);
    updateField("skills_raw", next.join(", "));
    setNewSkill("");
  };

  const removeSkill = (skillToRemove) => {
    const next = skillsList.filter((s) => s !== skillToRemove);
    updateField("skills", next);
    updateField("skills_raw", next.join(", "));
  };

  // Progress Bar ✅ 4 étapes
  const ProgressBar = () => (
    <div style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        {[1, 2, 3, 4].map((num) => (
          <div key={num} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: step >= num ? "#3b82f6" : "#e5e7eb",
                color: step >= num ? "#fff" : "#9ca3af",
                fontWeight: "700",
                fontSize: "16px",
                transition: "all 0.3s",
                marginBottom: "8px",
              }}
            >
              {step > num ? "✓" : num}
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: step === num ? "600" : "400",
                color: step === num ? "#111" : "#6b7280",
              }}
            >
              {num === 1 ? "CV" : num === 2 ? "Informations" : num === 3 ? "Documents" : "Contrat"}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: "4px", backgroundColor: "#e5e7eb", borderRadius: "2px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${((step - 1) / 3) * 100}%`,
            backgroundColor: "#3b82f6",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );

  // ÉTAPE 1
  if (step === 1) {
    return (
      <div
        style={{
          maxWidth: "650px",
          margin: "60px auto",
          padding: "50px 40px",
          borderRadius: "24px",
          backgroundColor: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        }}
      >
        <ProgressBar />

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 style={{ fontSize: "32px", fontWeight: "800", color: "#111", marginBottom: "12px" }}>
            Téléchargez votre CV
          </h2>
          <p style={{ color: "#6b7280", fontSize: "16px" }}>Nous extrairons automatiquement vos informations</p>
        </div>

        {cvError && (
          <div
            style={{
              backgroundColor: cvError.includes("✅") ? "#d1fae5" : cvError.includes("⚠️") ? "#fef3c7" : "#fee2e2",
              color: cvError.includes("✅") ? "#065f46" : cvError.includes("⚠️") ? "#92400e" : "#991b1b",
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "24px",
              fontWeight: "600",
              fontSize: "15px",
              textAlign: "center",
            }}
          >
            {cvError}
          </div>
        )}

        {loadingCV && (
          <div
            style={{
              backgroundColor: "#dbeafe",
              color: "#1e40af",
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "24px",
              textAlign: "center",
              fontWeight: "600",
              fontSize: "15px",
            }}
          >
            🔄 Analyse du CV en cours...
          </div>
        )}

        <div
          style={{
            border: "3px dashed #d1d5db",
            borderRadius: "16px",
            padding: "60px 40px",
            textAlign: "center",
            backgroundColor: "#f9fafb",
            transition: "all 0.3s",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3b82f6";
            e.currentTarget.style.backgroundColor = "#eff6ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#d1d5db";
            e.currentTarget.style.backgroundColor = "#f9fafb";
          }}
        >
          <input
            type="file"
            id="cv-upload"
            name="cv"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={loadingCV}
            style={{ display: "none" }}
          />
          <label htmlFor="cv-upload" style={{ display: "block", cursor: loadingCV ? "not-allowed" : "pointer" }}>
            <div style={{ fontSize: "64px", marginBottom: "20px" }}>📄</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#111", marginBottom: "8px" }}>
              {formData.cv ? formData.cv.name : "Cliquez pour sélectionner votre CV"}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280" }}>Format accepté : PDF uniquement</div>
          </label>
        </div>

        {formData.cv && !loadingCV && (
          <button
            onClick={() => setStep(2)}
            style={{
              width: "100%",
              marginTop: "24px",
              padding: "16px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontWeight: "700",
              fontSize: "16px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(59,130,246,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#3b82f6";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Passer à l'étape suivante →
          </button>
        )}
      </div>
    );
  }

  // ÉTAPE 2
  if (step === 2) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setStep(3);
        }}
        style={{
          maxWidth: "750px",
          margin: "60px auto",
          padding: "50px 40px",
          borderRadius: "24px",
          backgroundColor: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        }}
      >
        <ProgressBar />

        <div style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "32px", fontWeight: "800", color: "#111", marginBottom: "12px" }}>
            Vos informations
          </h2>
          <p style={{ color: "#6b7280", fontSize: "16px" }}>Vérifiez et complétez les informations extraites</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                Nom <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="nom"
                placeholder="Dupont"
                value={formData.nom}
                onChange={(e) => updateField("nom", e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                Prénom <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="prenom"
                placeholder="Jean"
                value={formData.prenom}
                onChange={(e) => updateField("prenom", e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Email <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="email"
              name="email"
              placeholder="jean.dupont@email.com"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Téléphone <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="tel"
              name="telephone"
              placeholder="06 12 34 56 78"
              value={formData.telephone}
              onChange={(e) => updateField("telephone", e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
              Adresse complète <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              name="adresse"
              placeholder="12 Rue de la République, 75001 Paris"
              value={formData.adresse}
              onChange={(e) => updateField("adresse", e.target.value)}
              style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              required
            />
          </div>

          {/* ✅ Compétences */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              padding: "20px",
              borderRadius: "12px",
              border: "2px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: 600, color: "#111", fontSize: "15px" }}>Compétences</span>
              <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 600 }}>{skillsList.length} trouvée(s)</span>
            </div>

            {skillsList.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                {skillsList.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: "#eff6ff",
                      color: "#1e40af",
                      border: "1px solid #bfdbfe",
                      padding: "8px 12px",
                      borderRadius: "999px",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      style={{
                        border: "none",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        fontWeight: 900,
                        color: "#1e40af",
                        fontSize: "14px",
                        lineHeight: 1,
                      }}
                      title="Supprimer"
                      aria-label={`Supprimer ${skill}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: 600, marginBottom: "16px" }}>
                ⚠️ Aucune compétence détectée automatiquement. Vous pouvez en ajouter manuellement.
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                value={newSkill}
                placeholder="Ajouter une compétence (ex: python, linux...)"
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />

              <button
                type="button"
                onClick={addSkill}
                style={{
                  backgroundColor: "#111",
                  color: "#fff",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontWeight: 700,
                  border: "none",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#3b82f6";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#111";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", marginTop: "40px" }}>
          <button
            type="button"
            onClick={() => setStep(1)}
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
            type="submit"
            style={{
              flex: 2,
              padding: "16px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontWeight: "700",
              fontSize: "16px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(59,130,246,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#3b82f6";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Continuer →
          </button>
        </div>
      </form>
    );
  }

  // ✅ ÉTAPE 4 : Contrat
  if (step === 4) {
    return (
      <Step4Contract
        formData={formData}
        setStep={setStep}
        onFinalSubmit={(finalData) => {
          if (typeof onSubmitForm === "function") onSubmitForm(finalData);
          if (typeof clearDraft === "function") clearDraft();
        }}
      />
    );
  }

  // ÉTAPE 3
  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: "750px",
        margin: "60px auto",
        padding: "50px 40px",
        borderRadius: "24px",
        backgroundColor: "#fff",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
      }}
    >
      <ProgressBar />
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 0.6; }
        }
        @keyframes checkPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .doc-ok {
          animation: checkPop 0.35s ease-out;
          color: #10b981;
          filter: drop-shadow(0 0 6px rgba(16,185,129,0.6));
        }
      `}</style>

      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "32px", fontWeight: "800", color: "#111", marginBottom: "12px" }}>
          Documents requis
        </h2>
        <p style={{ color: "#6b7280", fontSize: "16px" }}>
          Téléchargez tous les documents obligatoires pour finaliser votre dossier
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#fef3c7",
          padding: "16px 20px",
          borderRadius: "12px",
          fontSize: "14px",
          color: "#92400e",
          fontWeight: "600",
          marginBottom: "32px",
          borderLeft: "4px solid #f59e0b",
        }}
      >
        ⚠️ Votre pièce d'identité sera vérifiée automatiquement avec vos informations
        <br />
        ⚠️ Pour les autres documents : un PDF scanné (image dans PDF) donne souvent ⚠️.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <FileInput label="Pièce d'identité (vérification automatique)" name="identite" accept=".pdf,.jpg,.png,.jpeg" required />
        <FileInput label="Diplômes et certifications" name="diplomes" accept=".pdf,.jpg,.png,.jpeg" required />

        <FileInput label="RIB (document)" name="rib" accept=".pdf,.jpg,.png,.jpeg" required />

        <FileInput label="Casier judiciaire" name="casier" accept=".pdf,.jpg,.png,.jpeg" required />
        <FileInput label="Assurance RC Professionnelle" name="assurance" accept=".pdf,.jpg,.png,.jpeg" required />
        <FileInput label="Attestation fiscale" name="fiscale" accept=".pdf,.jpg,.png,.jpeg" required />
        <FileInput label="Attestation URSSAF" name="urssaf" accept=".pdf,.jpg,.png,.jpeg" required />
        <FileInput label="Déclaration d'activité" name="recpActivite" accept=".pdf,.jpg,.png,.jpeg" required />
        <FileInput label="Kbis ou équivalent" name="kbis" accept=".pdf,.jpg,.png,.jpeg" required />
      </div>

      <div style={{ display: "flex", gap: "16px", marginTop: "40px" }}>
        <button
          type="button"
          onClick={() => setStep(2)}
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
          type="submit"
          disabled={formData.identiteValid === false}
          style={{
            flex: 2,
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: formData.identiteValid === false ? "#9ca3af" : "#10b981",
            color: "#fff",
            fontWeight: "700",
            fontSize: "16px",
            cursor: formData.identiteValid === false ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (formData.identiteValid !== false) {
              e.currentTarget.style.backgroundColor = "#059669";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(16,185,129,0.3)";
            }
          }}
          onMouseLeave={(e) => {
            if (formData.identiteValid !== false) {
              e.currentTarget.style.backgroundColor = "#10b981";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }
          }}
        >
          Soumettre le dossier ✓
        </button>
      </div>
    </form>
  );
}
