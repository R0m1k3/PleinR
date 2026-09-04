"use client";

/**
 * Affichage unique d'identifiants fraîchement émis.
 *
 * Le mot de passe temporaire n'est stocké nulle part : il n'existe que dans
 * l'état de ce composant, le temps que le staff le relève. Un rechargement de
 * la page le fait disparaître définitivement (il reste possible de
 * réinitialiser le mot de passe pour en obtenir un nouveau).
 */
export type IssuedCredentialsItem = { label?: string; email: string; tempPassword: string };

export function OneTimeCredentials({
  items,
  title = "Identifiants à transmettre",
}: {
  items: IssuedCredentialsItem[];
  title?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div
      role="status"
      style={{ background: "#fbeede", border: "1px solid #ecd8b8", borderRadius: 12, padding: "14px 18px", fontSize: 13.5, color: "#9a6638" }}
    >
      <div className="font-display" style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={item.email} style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline" }}>
            {item.label && <span style={{ fontWeight: 700, color: "#6f4b23" }}>{item.label}</span>}
            <span>
              Identifiant : <strong>{item.email}</strong>
            </span>
            <span>
              Mot de passe temporaire :{" "}
              <strong style={{ fontFamily: "monospace", fontSize: 15, userSelect: "all" }}>{item.tempPassword}</strong>
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
        Notez-le maintenant : il n&apos;est affiché qu&apos;une seule fois et n&apos;est conservé nulle part.
        Un changement de mot de passe sera exigé à la première connexion.
      </div>
    </div>
  );
}
