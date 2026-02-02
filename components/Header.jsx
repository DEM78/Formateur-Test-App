import React from "react";

export default function Header({ onConnectClick }) {
  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <h1
          style={styles.logo}
          onClick={() => (window.location.href = "/")}
          onMouseEnter={e => {
            e.currentTarget.style.color = "#3b82f6";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "#111";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Caplogy
        </h1>

        <button
          onClick={onConnectClick}
          style={styles.button}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = "#2563eb";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 10px 25px rgba(59, 130, 246, 0.3)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "#3b82f6";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.2)";
          }}
        >
          Se connecter
        </button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 0,
    zIndex: 1000,
    backdropFilter: "blur(10px)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)"
  },
  container: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 40px"
  },
  logo: {
    margin: 0,
    fontWeight: "800",
    fontSize: "28px",
    color: "#111",
    cursor: "pointer",
    transition: "all 0.3s ease",
    letterSpacing: "-0.5px"
  },
  button: {
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    border: "none",
    padding: "12px 28px",
    cursor: "pointer",
    borderRadius: "12px",
    fontWeight: "700",
    fontSize: "15px",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)"
  }
};