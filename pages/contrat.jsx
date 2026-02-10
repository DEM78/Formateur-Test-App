// pages/contrat.jsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export default function ContratPage() {
  const router = useRouter();
  const [payload, setPayload] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("caplogy_contract_payload");
      if (!raw) {
        setError("Aucune donnée de contrat trouvée. Revenez à l'étape 4.");
        setLoading(false);
        return;
      }
      const data = JSON.parse(raw);
      setPayload(data);
    } catch (e) {
      setError("Impossible de charger le contrat.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!payload) return;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/generate-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employer: payload.employer,
            prestataire: payload.prestataire,
            variables: payload.variables,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Erreur API ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (e) {
        setError(e?.message || "Erreur génération contrat");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

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

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches && e.touches[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
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

  const sendSigned = async () => {
    if (!payload) return;
    if (!signatureDataUrl) {
      alert("Veuillez signer avant d'envoyer.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employer: payload.employer,
          prestataire: payload.prestataire,
          variables: {
            ...payload.variables,
            signature_data_url: signatureDataUrl,
            signature_confirmed: signatureConfirmed,
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erreur API ${res.status}`);
      }
      await res.blob();
      alert("Contrat signé envoyé.");
    } catch (e) {
      setError(e?.message || "Erreur génération contrat signé");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "980px",
        margin: "40px auto",
        padding: "30px 24px",
        borderRadius: "20px",
        backgroundColor: "#fff",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem("caplogy_force_step", "4");
            } catch {}
            window.location.href = "/";
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "999px",
            border: "2px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: "800",
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
          }}
        >
          ← Retour
        </button>
      </div>
      <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#111", marginBottom: "10px" }}>
        Contrat de prestation
      </h2>
      <p style={{ color: "#6b7280", marginBottom: "20px" }}>
        Vérifiez le contrat puis signez en bas de page.
      </p>

      {error && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "16px",
            fontWeight: "600",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: "14px", overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: "24px", textAlign: "center", color: "#3b82f6", fontWeight: "600" }}>
            Génération du contrat...
          </div>
        )}
        {!loading && pdfUrl && (
          <iframe title="Contrat" src={pdfUrl} style={{ width: "100%", height: "780px", border: "none" }} />
        )}
      </div>

      <div style={{ marginTop: "28px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#111", marginBottom: "12px" }}>
          Signature
        </h3>
        <div style={{ display: "flex", gap: "18px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ border: "2px dashed #e5e7eb", borderRadius: "14px", padding: "10px", background: "#ffffff" }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
              style={{ display: "block", borderRadius: "10px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setSignatureConfirmed(true)}
              disabled={!signatureDataUrl}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "none",
                background: signatureConfirmed ? "#10b981" : "#3b82f6",
                color: "#fff",
                fontWeight: "800",
                cursor: !signatureDataUrl ? "not-allowed" : "pointer",
                opacity: !signatureDataUrl ? 0.6 : 1,
              }}
            >
              {signatureConfirmed ? "Signature validée ✓" : "Valider la signature"}
            </button>
            <button
              type="button"
              onClick={clearSignature}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "2px solid #e5e7eb",
                background: "#fff",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Effacer la signature
            </button>
            <button
              type="button"
              onClick={sendSigned}
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                border: "none",
                background: "#111",
                color: "#fff",
                fontWeight: "800",
                cursor: "pointer",
              }}
            >
              Signer et envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
