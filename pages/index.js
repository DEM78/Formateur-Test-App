// pages/index.js - VERSION CORRIGÉE (sans TypeScript, sans window hack)
import { useState } from "react";
import Header from "../components/Header";
import RoleSelection from "../components/RoleSelection";
import FormateurFormView from "../components/formateur/FormateurFormView";
import { useFormateurForm } from "../components/formateur/useFormateurForm";

export default function Home() {
  const [step, setStep] = useState("home");

  const handleConnectClick = () => setStep("roles");
  const handleSelectFormateur = () => setStep("formateur");

  const handleSubmitForm = (data) => {
    console.log("📋 Formulaire soumis :", data);

    // ✅ Afficher résumé complet
    console.log("Nom/Prénom:", data.nom, data.prenom);
    console.log("Compétences:", data.skills);
    console.log("Documents:", {
      cv: data.cv?.name,
      identite: data.identite?.name,
      identiteValid: data.identiteValid,
      diplomes: data.diplomes?.name,
      kbis: data.kbis?.name,
    });

    if (data.contrat) {
      console.log("Contrat:", {
        employeur: data.contrat.employer?.denomination,
        prestataire: data.contrat.prestataire?.siren,
        taux: data.contrat.variables?.taux_journalier,
      });
    }

    alert("✅ Dossier envoyé avec succès ! Nous reviendrons vers vous rapidement.");

    // ✅ Nettoyer le brouillon après soumission
    try {
      localStorage.removeItem("caplogy_formateur_draft");
    } catch (e) {
      console.warn("Impossible de nettoyer le brouillon", e);
    }

    // Retour à l'accueil
    setStep("home");
  };

  return (
    <div style={styles.container}>
      <Header onConnectClick={handleConnectClick} />

      {step === "home" && <HomePage onGetStarted={handleConnectClick} />}
      {step === "roles" && <RoleSelection onSelect={handleSelectFormateur} />}
      {step === "formateur" && <FormateurFormComponent onSubmitForm={handleSubmitForm} />}
    </div>
  );
}

// ✅ Wrapper component pour passer onSubmitForm au hook + props au FormView (step4 incluse)
function FormateurFormComponent({ onSubmitForm }) {
  const formHook = useFormateurForm({ onSubmitForm });

  // ✅ IMPORTANT :
  // On ne met plus onSubmitForm dans window.
  // FormateurFormView reçoit onSubmitForm + clearDraft directement.
  return (
    <FormateurFormView
      {...formHook}
      onSubmitForm={onSubmitForm}
      clearDraft={formHook.clearDraft}
    />
  );
}

function HomePage({ onGetStarted }) {
  return (
    <div style={styles.heroWrapper}>
      {/* Hero Section Centré */}
      <div style={styles.heroSection}>
        <div style={styles.heroContent}>
          <div style={styles.glowEffect} />

          <h1 style={styles.heroTitle}>
            Devenez formateur
            <br />
            <span style={styles.gradientText}>d'excellence</span>
          </h1>

          <p style={styles.heroSubtitle}>
            Rejoignez une communauté de 500+ formateurs experts et partagez votre savoir-faire avec les meilleures
            entreprises françaises.
          </p>

          <button
            onClick={onGetStarted}
            style={styles.ctaButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 25px 60px rgba(59, 130, 246, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 20px 50px rgba(59, 130, 246, 0.3)";
            }}
          >
            Créer mon profil gratuitement
            <span style={styles.ctaArrow}>→</span>
          </button>

          <div style={styles.trustBadges}>
            <span style={styles.trustItem}>✓ Gratuit</span>
            <span style={styles.trustDivider}>•</span>
            <span style={styles.trustItem}>✓ Rapide (3 min)</span>
            <span style={styles.trustDivider}>•</span>
            <span style={styles.trustItem}>✓ Vérifié</span>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div style={styles.featuresSection}>
        <h2 style={styles.sectionTitle}>Pourquoi choisir Caplogy ?</h2>

        <div style={styles.featuresGrid}>
          <FeatureCard
            icon="⚡"
            title="Inscription simplifiée"
            description="Créez votre profil en 3 minutes. Notre IA analyse votre CV automatiquement."
            color="#3b82f6"
          />
          <FeatureCard
            icon="🔒"
            title="Vérification automatique"
            description="Documents validés instantanément grâce à notre système de reconnaissance intelligent."
            color="#8b5cf6"
          />
          <FeatureCard
            icon="💰"
            title="Paiements sécurisés"
            description="Recevez vos honoraires rapidement et en toute sécurité via virement bancaire."
            color="#10b981"
          />
          <FeatureCard
            icon="🎯"
            title="Missions qualifiées"
            description="Accédez à des opportunités exclusives correspondant à votre expertise."
            color="#f59e0b"
          />
        </div>
      </div>

      {/* Stats Section */}
      <div style={styles.statsSection}>
        <div style={styles.statsGrid}>
          <StatCard number="500+" label="Formateurs actifs" />
          <StatCard number="1200+" label="Formations données" />
          <StatCard number="98%" label="Taux de satisfaction" />
          <StatCard number="250+" label="Entreprises partenaires" />
        </div>
      </div>

      {/* CTA Final */}
      <div style={styles.finalCta}>
        <h2 style={styles.finalCtaTitle}>Prêt à commencer ?</h2>
        <p style={styles.finalCtaText}>
          Rejoignez notre réseau de formateurs et accédez à des missions passionnantes dès aujourd'hui.
        </p>
        <button
          onClick={onGetStarted}
          style={styles.finalCtaButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2563eb";
            e.currentTarget.style.transform = "translateY(-3px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#3b82f6";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Commencer maintenant
        </button>
      </div>
    </div>
  );
}

// Composant Feature Card
function FeatureCard({ icon, title, description, color }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.featureCard,
        transform: isHovered ? "translateY(-8px)" : "translateY(0)",
        boxShadow: isHovered ? "0 20px 50px rgba(0, 0, 0, 0.12)" : "0 8px 25px rgba(0, 0, 0, 0.08)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ ...styles.featureIconBox, backgroundColor: `${color}15` }}>
        <span style={styles.featureIcon}>{icon}</span>
      </div>
      <h3 style={styles.featureTitle}>{title}</h3>
      <p style={styles.featureDescription}>{description}</p>
    </div>
  );
}

// Composant Stat Card
function StatCard({ number, label }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statNumber}>{number}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#ffffff",
    minHeight: "100vh",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  heroWrapper: {
    width: "100%",
  },
  heroSection: {
    minHeight: "calc(100vh - 81px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    background: "linear-gradient(135deg, #f9fafb 0%, #ffffff 50%, #eff6ff 100%)",
    overflow: "hidden",
  },
  glowEffect: {
    position: "absolute",
    top: "-50%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "800px",
    height: "800px",
    background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
    borderRadius: "50%",
    filter: "blur(60px)",
    pointerEvents: "none",
  },
  heroContent: {
    textAlign: "center",
    maxWidth: "800px",
    padding: "0 40px",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontSize: "72px",
    fontWeight: "900",
    color: "#111",
    lineHeight: "1.1",
    marginBottom: "32px",
    letterSpacing: "-2px",
  },
  gradientText: {
    background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSubtitle: {
    fontSize: "22px",
    color: "#6b7280",
    lineHeight: "1.7",
    marginBottom: "48px",
    maxWidth: "650px",
    margin: "0 auto 48px",
  },
  ctaButton: {
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "20px 48px",
    borderRadius: "16px",
    fontSize: "18px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 20px 50px rgba(59, 130, 246, 0.3)",
    display: "inline-flex",
    alignItems: "center",
    gap: "12px",
  },
  ctaArrow: {
    fontSize: "20px",
    transition: "transform 0.3s ease",
  },
  trustBadges: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    marginTop: "32px",
    fontSize: "15px",
    color: "#6b7280",
  },
  trustItem: {
    fontWeight: "500",
  },
  trustDivider: {
    color: "#d1d5db",
  },
  featuresSection: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "120px 40px",
  },
  sectionTitle: {
    fontSize: "48px",
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
    marginBottom: "60px",
    letterSpacing: "-1px",
  },
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "32px",
  },
  featureCard: {
    backgroundColor: "#fff",
    padding: "40px 32px",
    borderRadius: "24px",
    border: "2px solid #e5e7eb",
    transition: "all 0.3s ease",
    boxShadow: "0 8px 25px rgba(0, 0, 0, 0.08)",
  },
  featureIconBox: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "24px",
  },
  featureIcon: {
    fontSize: "32px",
  },
  featureTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#111",
    marginBottom: "12px",
  },
  featureDescription: {
    fontSize: "15px",
    color: "#6b7280",
    lineHeight: "1.6",
  },
  statsSection: {
    backgroundColor: "#f9fafb",
    padding: "80px 40px",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "40px",
    maxWidth: "1000px",
    margin: "0 auto",
  },
  statCard: {
    textAlign: "center",
  },
  statNumber: {
    fontSize: "48px",
    fontWeight: "800",
    color: "#3b82f6",
    marginBottom: "12px",
    letterSpacing: "-1px",
  },
  statLabel: {
    fontSize: "16px",
    color: "#6b7280",
    fontWeight: "500",
  },
  finalCta: {
    textAlign: "center",
    padding: "120px 40px",
    maxWidth: "700px",
    margin: "0 auto",
  },
  finalCtaTitle: {
    fontSize: "48px",
    fontWeight: "800",
    color: "#111",
    marginBottom: "24px",
    letterSpacing: "-1px",
  },
  finalCtaText: {
    fontSize: "20px",
    color: "#6b7280",
    lineHeight: "1.7",
    marginBottom: "40px",
  },
  finalCtaButton: {
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "18px 48px",
    borderRadius: "12px",
    fontSize: "18px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 10px 30px rgba(59, 130, 246, 0.2)",
  },
};
