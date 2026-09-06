/**
 * Pastille ronde d'un adhérent : son logo, sinon ses initiales.
 *
 * Sert à identifier le commerce d'un coup d'œil devant son nom, notamment sur
 * les cartes de promotion. Le logo est rendu en `contain` sur fond blanc : la
 * plupart des logos d'adhérents sont des marques sur fond clair, un `cover` les
 * rognerait.
 */

export function memberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MemberAvatar({
  name,
  logoUrl,
  size = 26,
  accent = "#E0A63C",
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  accent?: string;
}) {
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (logoUrl) {
    return (
      <span
        aria-hidden="true"
        style={{ ...common, background: "#fff", border: "1px solid #eee3cf" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2, boxSizing: "border-box" }}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        ...common,
        background: accent,
        color: "#fff",
        fontWeight: 800,
        fontSize: Math.round(size * 0.4),
        letterSpacing: "0.02em",
      }}
    >
      {memberInitials(name)}
    </span>
  );
}
