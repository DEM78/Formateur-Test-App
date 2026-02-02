import React from "react";

const roles = [
  { 
    label: "Formateur", 
    enabled: true,
    icon: "🎓",
    description: "Rejoignez notre réseau de formateurs"
  },
  { 
    label: "Entreprise", 
    enabled: false,
    icon: "🏢",
    description: "Trouvez les meilleurs formateurs"
  },
  { 
    label: "Étudiant", 
    enabled: false,
    icon: "📚",
    description: "Accédez à nos formations"
  },
  { 
    label: "Partenaire", 
    enabled: false,
    icon: "🤝",
    description: "Collaborez avec nous"
  }
];

export default function RoleSelection({ onSelect }) {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={styles.title}>Choisissez votre profil</h2>
        <p style={styles.subtitle}>
          Sélectionnez le type de compte que vous souhaitez créer
        </p>

        <div style={styles.grid}>
          {roles.map((role, index) => (
            <div
              key={index}
              onClick={() => role.enabled && onSelect()}
              style={{
                ...styles.card,
                cursor: role.enabled ? "pointer" : "not-allowed",
                opacity: role.enabled ? 1 : 0.5,
                backgroundColor: role.enabled ? "#fff" : "#f9fafb"
              }}
              onMouseEnter={e => {
                if (role.enabled) {
                  e.currentTarget.style.transform = "translateY(-8px)";
                  e.currentTarget.style.boxShadow = "0 20px 50px rgba(59, 130, 246, 0.2)";
                  e.currentTarget.style.borderColor = "#3b82f6";
                }
              }}
              onMouseLeave={e => {
                if (role.enabled) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.08)";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }
              }}
            >
              <div style={styles.iconContainer}>
                <span style={styles.icon}>{role.icon}</span>
              </div>
              
              <h3 style={styles.roleTitle}>{role.label}</h3>
              <p style={styles.roleDescription}>{role.description}</p>

              {!role.enabled && (
                <div style={styles.comingSoon}>
                  Bientôt disponible
                </div>
              )}

              {role.enabled && (
                <div style={styles.arrow}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "calc(100vh - 81px)",
    backgroundColor: "#f9fafb",
    padding: "80px 40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    maxWidth: "1200px",
    width: "100%"
  },
  title: {
    fontSize: "48px",
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
    marginBottom: "16px",
    letterSpacing: "-1px"
  },
  subtitle: {
    fontSize: "18px",
    color: "#6b7280",
    textAlign: "center",
    marginBottom: "60px"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "30px",
    maxWidth: "800px",
    margin: "0 auto"
  },
  card: {
    backgroundColor: "#fff",
    padding: "40px 30px",
    borderRadius: "24px",
    border: "2px solid #e5e7eb",
    textAlign: "center",
    transition: "all 0.3s ease",
    boxShadow: "0 8px 25px rgba(0, 0, 0, 0.08)",
    position: "relative",
    overflow: "hidden"
  },
  iconContainer: {
    width: "80px",
    height: "80px",
    backgroundColor: "#eff6ff",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
    transition: "all 0.3s ease"
  },
  icon: {
    fontSize: "40px"
  },
  roleTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111",
    marginBottom: "12px"
  },
  roleDescription: {
    fontSize: "15px",
    color: "#6b7280",
    lineHeight: "1.6",
    marginBottom: "20px"
  },
  comingSoon: {
    display: "inline-block",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    padding: "6px 16px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "600"
  },
  arrow: {
    fontSize: "24px",
    color: "#3b82f6",
    fontWeight: "700"
  }
};