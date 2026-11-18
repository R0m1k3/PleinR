"use client";

import { useEffect, useState } from "react";
import { PromoImage } from "./PromoImage";
import { Sparkle } from "./Sparkle";

/**
 * Carrousel « Entreprises à découvrir » de l'accueil : une entreprise à la
 * fois, rédigée par l'association dans Paramètres (4 au plus).
 *
 * Défilement auto toutes les 7 s, suspendu au survol, au focus, par le bouton
 * Pause (WCAG 2.2.2) et si l'utilisateur a demandé moins d'animations. Les
 * images arrivent par `/api/spotlights/[slot]/image`, jamais en data-URI ici.
 */
export type SpotlightItem = {
  slot: number;
  name: string;
  text: string;
  imageSrc: string | null;
};

const INTERVAL_MS = 7_000;
const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

export function SpotlightCarousel({ items }: { items: SpotlightItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const total = items.length;
  const multiple = total > 1;
  const auto = multiple && !paused && !hover && !focused && !reducedMotion;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const tick = setInterval(() => setIndex((i) => (i + 1) % total), INTERVAL_MS);
    return () => clearInterval(tick);
  }, [auto, total]);

  if (total === 0) return null;
  const go = (i: number) => setIndex((i + total) % total);

  return (
    <section
      role="region"
      aria-roledescription="carrousel"
      aria-label="Entreprises à découvrir"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      style={{
        position: "relative",
        margin: "46px 0 0",
        background: "#fff",
        border: "1px solid #e6dcc6",
        borderRadius: 24,
        padding: "34px 36px 30px",
        overflow: "hidden",
        boxShadow: "0 26px 60px -40px rgba(40,30,15,0.5)",
      }}
    >
      <Sparkle color="#6FB0C6" size={18} style={{ top: 26, right: 42 }} duration={3.1} />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#eaf0f6",
          color: "#2C6FB3",
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 800,
          padding: "6px 13px",
          borderRadius: 999,
          marginBottom: 12,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2C6FB3" }} />
        Entreprises à découvrir
      </div>
      <h2
        className="font-display"
        style={{ fontWeight: 800, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em", margin: "0 0 22px", color: "#26201a" }}
      >
        Coup de projecteur
      </h2>

      <div aria-live={auto ? "off" : "polite"}>
        {items.map((item, i) => (
          <div
            key={item.slot}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${total}`}
            hidden={i !== index}
            className="spotlight-grid"
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "4 / 3",
                borderRadius: 18,
                overflow: "hidden",
                background: STRIPE_WARM,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.imageSrc ? (
                <PromoImage src={item.imageSrc} alt={item.name} />
              ) : (
                <span style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>
                  {item.name}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 className="font-display" style={{ fontWeight: 800, fontSize: "clamp(20px, 4vw, 26px)", margin: "0 0 12px", color: "#26201a" }}>
                {item.name}
              </h3>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "#6c6150", whiteSpace: "pre-line" }}>
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {multiple && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 22, flexWrap: "wrap" }}>
          <button type="button" onClick={() => go(index - 1)} aria-label="Entreprise précédente" style={arrowButton}>
            ‹
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {items.map((item, i) => (
              <button
                key={item.slot}
                type="button"
                onClick={() => go(i)}
                aria-label={`Afficher ${item.name}`}
                aria-current={i === index ? "true" : undefined}
                style={{
                  width: i === index ? 26 : 10,
                  height: 10,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  background: i === index ? "#2C6FB3" : "#d6c9ad",
                  cursor: "pointer",
                  transition: "width 0.25s ease, background 0.25s ease",
                }}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(index + 1)} aria-label="Entreprise suivante" style={arrowButton}>
            ›
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Reprendre le défilement" : "Mettre le défilement en pause"}
            style={{ ...arrowButton, width: "auto", padding: "0 14px", fontSize: 13, fontWeight: 700 }}
          >
            {paused ? "Lecture" : "Pause"}
          </button>
        </div>
      )}
    </section>
  );
}

const arrowButton = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: "1px solid #e6dcc6",
  background: "#fff",
  color: "#6f6450",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
} as const;
