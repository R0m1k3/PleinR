export function SiteFooter() {
  return (
    <footer style={{ background: "#EFE9DA", borderTop: "1px solid #e2d6bd", padding: "28px 56px" }}>
      <div
        className="container"
        style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}
      >
        <div style={{ fontSize: 13, color: "#8c8068", textAlign: "right", lineHeight: 1.7 }}>
          contact@plein-r.fr · Bassin de Pompey
          <br />
          Réseau · Rencontre · Réussite
        </div>
      </div>
    </footer>
  );
}
