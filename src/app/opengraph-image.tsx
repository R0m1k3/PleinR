import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

/**
 * Image de partage (Open Graph / Twitter) générée à la volée, 1200×630.
 * Sert de vignette par défaut à toutes les pages ; les fiches adhérents la
 * reprennent, leurs logos étant stockés en data-URI (illisibles par les
 * robots de prévisualisation).
 */
export const alt = "Plein R — Commerçants & entreprises du Bassin de Pompey";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Logo servi depuis `public/` (copié dans l'image standalone), en data-URI pour Satori. */
async function logoDataUri(): Promise<string | null> {
  try {
    const file = await readFile(path.join(process.cwd(), "public", "assets", "logo.png"));
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const logo = await logoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #F6F2E8 0%, #efe9da 100%)",
          color: "#26201a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" width={120} height={120} style={{ objectFit: "contain" }} />
          ) : (
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 24,
                background: "#E0A63C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#26201a",
                fontSize: 48,
                fontWeight: 800,
              }}
            >
              R
            </div>
          )}
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#9a6638", fontWeight: 700 }}>
            Réseau · Rencontre · Réussite
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, display: "flex", flexWrap: "wrap" }}>
            Le cœur commerçant du&nbsp;
            <span style={{ color: "#2C6FB3" }}>Bassin de Pompey</span>
          </div>
          <div style={{ fontSize: 30, color: "#6c6150", marginTop: 8 }}>
            Annuaire des commerçants, artisans et entreprises · Bons plans · Rencontres
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["#E0A63C", "#2C6FB3", "#d8472b", "#1f8a5b"].map((c) => (
            <div key={c} style={{ width: 64, height: 10, borderRadius: 999, background: c }} />
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
