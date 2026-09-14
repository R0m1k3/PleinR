"use client";

/**
 * Affichage unique d'identifiants fraîchement émis.
 *
 * Le mot de passe temporaire n'est stocké nulle part : il n'existe que dans
 * l'état de ce composant, le temps que le staff le relève. Un rechargement de
 * la page le fait disparaître définitivement (il reste possible de
 * réinitialiser le mot de passe pour en obtenir un nouveau).
 *
 * L'envoi par e-mail est un **plus**, jamais un remplacement : le mot de passe
 * reste affiché même quand le message est parti, et surtout quand il n'a pas
 * pu partir. Boîte mail non configurée, le panneau se comporte exactement
 * comme avant.
 */
export type IssuedCredentialsItem = {
  label?: string;
  email: string;
  tempPassword: string;
  mailed?: boolean;
  mailError?: string;
};

function Delivery({ item }: { item: IssuedCredentialsItem }) {
  if (item.mailed === undefined) return null;
  if (item.mailed) {
    return (
      <span style={{ color: "#1f8a5b", fontWeight: 700 }}>✓ Envoyé à {item.email}</span>
    );
  }
  return (
    <span style={{ color: "#a8503c", fontWeight: 700 }}>
      Envoi impossible — transmettez-le à la main
      {item.mailError ? ` (${item.mailError.slice(0, 120)})` : ""}
    </span>
  );
}

export function OneTimeCredentials({
  items,
  title = "Identifiants à transmettre",
}: {
  items: IssuedCredentialsItem[];
  title?: string;
}) {
  if (items.length === 0) return null;
  const allMailed = items.every((item) => item.mailed);

  return (
    <div
      role="status"
      style={{ background: "#fbeede", border: "1px solid #ecd8b8", borderRadius: 12, padding: "14px 18px", fontSize: 13.5, color: "#9a6638" }}
    >
      <div className="font-display" style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            <Delivery item={item} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
        {allMailed
          ? "Le message est parti, mais notez-le quand même : il n'est affiché qu'une seule fois et n'est conservé nulle part."
          : "Notez-le maintenant : il n'est affiché qu'une seule fois et n'est conservé nulle part."}{" "}
        Un changement de mot de passe sera exigé à la première connexion.
      </div>
    </div>
  );
}
