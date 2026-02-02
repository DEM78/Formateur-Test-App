// components/formateur/useFormateurForm.js
import { useState, useEffect } from "react";

export function useFormateurForm({ onSubmitForm }) {
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    adresse: "",
    telephone: "",
    cv: null,
    identite: null,
    diplomes: null,
    rib: "",
    casier: null,
    assurance: null,
    fiscale: null,
    urssaf: null,
    recpActivite: null,
    kbis: null,
    identiteValid: null, // true | false | null
    skills: [],
    skills_raw: "",
  });

  const [loadingCV, setLoadingCV] = useState(false);
  const [cvError, setCvError] = useState("");

  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("");

  const [verifyingDocs, setVerifyingDocs] = useState({
    diplomes: false,
    casier: false,
    assurance: false,
    fiscale: false,
    urssaf: false,
    recpActivite: false,
    kbis: false,
  });

  const [docStatus, setDocStatus] = useState({
    diplomes: null,
    casier: null,
    assurance: null,
    fiscale: null,
    urssaf: null,
    recpActivite: null,
    kbis: null,
  });

  const [docMessage, setDocMessage] = useState({
    diplomes: "",
    casier: "",
    assurance: "",
    fiscale: "",
    urssaf: "",
    recpActivite: "",
    kbis: "",
  });

  // ✅ Persistance auto-save
  useEffect(() => {
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft();
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, step]);

  const updateField = (name, value) => setFormData((prev) => ({ ...prev, [name]: value }));
  const setDocVerifying = (name, value) => setVerifyingDocs((prev) => ({ ...prev, [name]: value }));
  const setStatus = (name, status) => setDocStatus((prev) => ({ ...prev, [name]: status }));
  const setMessage = (name, message) => setDocMessage((prev) => ({ ...prev, [name]: message }));

  const saveDraft = () => {
    try {
      const draft = {
        step,
        formData: {
          ...formData,
          cv: null,
          identite: null,
          diplomes: null,
          casier: null,
          assurance: null,
          fiscale: null,
          urssaf: null,
          recpActivite: null,
          kbis: null,
        },
        docStatus,
        docMessage,
      };
      localStorage.setItem("caplogy_formateur_draft", JSON.stringify(draft));
    } catch (e) {
      console.warn("Impossible de sauvegarder le brouillon", e);
    }
  };

  const loadDraft = () => {
    try {
      const saved = localStorage.getItem("caplogy_formateur_draft");
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.step) setStep(draft.step);
        if (draft.formData) setFormData((prev) => ({ ...prev, ...draft.formData }));
        if (draft.docStatus) setDocStatus(draft.docStatus);
        if (draft.docMessage) setDocMessage(draft.docMessage);
      }
    } catch (e) {
      console.warn("Impossible de charger le brouillon", e);
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem("caplogy_formateur_draft");
    } catch (e) {
      console.warn("Impossible de supprimer le brouillon", e);
    }
  };

  // ----------------- Helpers -----------------
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const isPdfFile = (file) =>
    file?.type === "application/pdf" || (file?.name || "").toLowerCase().endsWith(".pdf");

  const pdfToText = async (file) => {
    const base64 = await fileToBase64(file);
    const res = await fetch("/api/extract-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileBase64: base64 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || "Erreur extraction PDF";
      throw new Error(msg);
    }
    return data.texteCV || "";
  };

  const ocrPdfToText = async (file) => {
    const base64 = await fileToBase64(file);
    const res = await fetch("/api/ocr-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileBase64: base64, maxPages: 1 }),
    });

    const data = await res.json().catch(() => ({}));
    return (data.texteCV || "").trim();
  };

  const mapDocType = (name) => {
    if (name === "diplomes") return "diplome";
    if (name === "recpActivite") return "declaration";
    return name;
  };

  // ----------------- CV -----------------
  const handleCVUpload = async (file) => {
    updateField("cv", file);
    setCvError("");
    setLoadingCV(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];

        const res = await fetch(process.env.NEXT_PUBLIC_CV_ANALYZER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: base64 }),
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || "Erreur lors de l'analyse du CV");
        }

        const { nom, prenom, email, telephone, adresse, skills, skills_raw } = result.data || {};

        let fieldsFound = 0;
        if (nom) { updateField("nom", nom); fieldsFound++; }
        if (prenom) { updateField("prenom", prenom); fieldsFound++; }
        if (email) { updateField("email", email); fieldsFound++; }
        if (telephone) { updateField("telephone", telephone); fieldsFound++; }
        if (adresse) { updateField("adresse", adresse); fieldsFound++; }

        if (skills && Array.isArray(skills)) {
          updateField("skills", skills);
          fieldsFound++;
        }
        if (skills_raw) updateField("skills_raw", skills_raw);

        if (fieldsFound > 0) {
          const skillMsg = skills?.length > 0 ? ` + ${skills.length} compétences` : "";
          setCvError(`✅ ${fieldsFound} information(s) extraite(s) avec succès${skillMsg}`);
          setTimeout(() => setStep(2), 1500);
        } else {
          setCvError("⚠️ Aucune information trouvée. Remplissez manuellement.");
          setTimeout(() => setStep(2), 2000);
        }
      } catch (err) {
        console.error("Erreur CV:", err);
        setCvError("❌ Impossible d'analyser le CV. Remplissez manuellement.");
        setTimeout(() => setStep(2), 2000);
      } finally {
        setLoadingCV(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // ----------------- IDENTITÉ (TRI-ÉTAT) -----------------
  const handleIdentityUpload = async (file) => {
    updateField("identite", file);
    setVerifyingIdentity(true);
    setIdentityMessage("🔄 Vérification en cours...");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];

        const res = await fetch(process.env.NEXT_PUBLIC_DOCUMENT_VERIFIER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: base64,
            type: "identite",
            nom: formData.nom,
            prenom: formData.prenom,
          }),
        });

        const data = await res.json().catch(() => ({}));

        const valid = data?.valide === true ? true : data?.valide === false ? false : null;
        updateField("identiteValid", valid);

        if (valid === true) {
          setIdentityMessage("✅ Pièce d'identité validée");
          return;
        }

        if (valid === false) {
          if (data?.comparaison) {
            setIdentityMessage(
              `❌ Non valide - Nom trouvé: "${data.comparaison.nom_piece || "non détecté"}" | ` +
              `Prénom trouvé: "${data.comparaison.prenom_piece || "non détecté"}"`
            );
          } else {
            setIdentityMessage("❌ Document non reconnu ou illisible");
          }
          return;
        }

        // null => inconclus
        if (data?.comparaison) {
          setIdentityMessage(
            `⚠️ À vérifier - Nom trouvé: "${data.comparaison.nom_piece || "non détecté"}" | ` +
            `Prénom trouvé: "${data.comparaison.prenom_piece || "non détecté"}"`
          );
        } else {
          setIdentityMessage("⚠️ À vérifier - Document partiellement lisible");
        }
      } catch (err) {
        console.error("Erreur vérif identité:", err);
        updateField("identiteValid", null);
        setIdentityMessage("⚠️ Erreur lors de la vérification (à vérifier)");
      } finally {
        setVerifyingIdentity(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // ----------------- AUTRES DOCS -----------------
  const verifyOtherDoc = async (docName, file) => {
    if (!formData.nom || !formData.prenom) {
      setStatus(docName, "REVIEW");
      setMessage(docName, "⚠️ Renseignez Nom/Prénom avant vérification");
      return;
    }

    setDocVerifying(docName, true);
    setStatus(docName, null);
    setMessage(docName, "🔄 Vérification en cours...");

    try {
      const payloadBase = {
        docType: mapDocType(docName),
        referenceData: { nom: formData.nom, prenom: formData.prenom },
      };

      let payload = { ...payloadBase };

      if (isPdfFile(file)) {
        let text = "";
        try {
          text = await pdfToText(file);
        } catch (err) {
          setStatus(docName, "REVIEW");
          setMessage(docName, "⚠️ PDF illisible en texte (souvent scan). Vérification automatique limitée.");
          return;
        }

        if (!text || text.trim().length < 30) {
          if (docName === "diplomes") {
            const ocrText = await ocrPdfToText(file);
            if (!ocrText || ocrText.length < 30) {
              setStatus(docName, "REVIEW");
              setMessage(docName, "⚠️ OCR impossible / scan trop flou. Envoie une image nette JPG/PNG.");
              return;
            }
            payload.contentType = "pdf_text";
            payload.text = ocrText;
          } else {
            setStatus(docName, "REVIEW");
            setMessage(docName, "⚠️ PDF scanné détecté (pas de texte). Envoie une image JPG/PNG si tu veux un ✅ automatique.");
            return;
          }
        } else {
          payload.contentType = "pdf_text";
          payload.text = text;
        }
      } else {
        const base64 = await fileToBase64(file);
        payload.contentType = "image";
        payload.fileBase64 = base64;
      }

      const res = await fetch(process.env.NEXT_PUBLIC_DOCUMENT_CHECKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      const status = data.status || (data.valide === true ? "OK" : "REVIEW");
      setStatus(docName, status);

      if (status === "OK") setMessage(docName, "✅ Document cohérent");
      else if (status === "FAIL") setMessage(docName, "❌ Document incohérent");
      else {
        const reason = data.reason ? ` (${data.reason})` : "";
        setMessage(docName, `⚠️ À vérifier${reason}`);
      }
    } catch (err) {
      console.error("Erreur vérif doc:", docName, err);
      setStatus(docName, "REVIEW");
      setMessage(docName, "⚠️ Vérification automatique indisponible pour ce fichier (à vérifier)");
    } finally {
      setDocVerifying(docName, false);
    }
  };

  // ----------------- Handle change -----------------
  const handleFileChange = async (e) => {
    const { name, files } = e.target;
    if (!files?.[0]) return;

    const file = files[0];

    if (name === "cv") {
      handleCVUpload(file);
      return;
    }

    if (name === "identite") {
      handleIdentityUpload(file);
      return;
    }

    updateField(name, file);
    await verifyOtherDoc(name, file);
  };

  // ✅ VALIDATION: on remplace la validation browser `required` file inputs
  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.identiteValid === false) {
      alert("❌ Veuillez fournir une pièce d'identité valide correspondant à vos informations (nom et prénom)");
      return;
    }

    const missing = [];
    if (!formData.identite) missing.push("Pièce d'identité");
    if (!formData.diplomes) missing.push("Diplômes et certifications");
    if (!formData.rib || !String(formData.rib).trim()) missing.push("RIB (IBAN)");
    if (!formData.casier) missing.push("Casier judiciaire");
    if (!formData.assurance) missing.push("Assurance RC Professionnelle");
    if (!formData.fiscale) missing.push("Attestation fiscale");
    if (!formData.urssaf) missing.push("Attestation URSSAF");
    if (!formData.recpActivite) missing.push("Déclaration d'activité");
    if (!formData.kbis) missing.push("Kbis ou équivalent");

    if (missing.length > 0) {
      alert("⚠️ Documents manquants :\n- " + missing.join("\n- "));
      return;
    }

    // ✅ passer à l'étape 4 (contrat)
    setStep(4);
  };

  const getDocIcon = (name) => {
    if (verifyingDocs[name]) return "⏳";
    const s = docStatus[name];
    if (s === "OK") return "✅";
    if (s === "FAIL") return "❌";
    if (s === "REVIEW") return "⚠️";
    return "";
  };

  return {
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
    clearDraft,
    onSubmitForm,
  };
}
