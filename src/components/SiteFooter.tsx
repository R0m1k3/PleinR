import { ContactModalButton } from "./ContactModalButton";

export function SiteFooter() {
  return (
    <footer style={{ background: "#EFE9DA", borderTop: "1px solid #e2d6bd", padding: "28px clamp(16px, 5vw, 56px)" }}>
      <div
        className="container"
        style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}
      >
        <div style={{ fontSize: 13, color: "#8c8068", textAlign: "right", lineHeight: 1.7 }}>
          <ContactModalButton
            label="Nous contacter"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "#9a6638",
              fontWeight: 700,
              textDecoration: "underline",
            }}
          />
          {" · Bassin de Pompey"}
          <br />
          Réseau · Rencontre · Réussite
        </div>
      </div>
    </footer>
  );
}
