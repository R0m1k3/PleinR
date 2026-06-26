export function SiteFooter() {
  return (
    <footer style={{ background: "#EFE9DA", borderTop: "1px solid #e2d6bd", padding: "28px 56px" }}>
      <div
        className="container"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="Plein R" style={{ height: 36, width: "auto" }} />
          <span className="font-display" style={{ fontWeight: 800, fontSize: 16, color: "#13324F" }}>
            Plein R
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#8c8068", textAlign: "right", lineHeight: 1.7 }}>
          contact@plein-r.fr · Bassin de Pompey
          <br />
          Réseau · Rencontre · Réussite
        </div>
      </div>
    </footer>
  );
}
