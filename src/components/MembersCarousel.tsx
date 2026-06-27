"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VitrineImage } from "./VitrineImage";

export type CarouselMember = {
  id: number;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  categoryLabel: string | null;
  accent: string | null;
};

const VISIBLE = 3;
const INTERVAL_MS = 20_000;
const STAGGER_MS = 220; // décalage de disparition/apparition entre cartes
const FADE_MS = 450;

function Card({ m, visible, index }: { m: CarouselMember; visible: boolean; index: number }) {
  return (
    <Link
      href={`/adherents/${m.id}`}
      className="lift-card"
      style={{
        background: "#fff",
        border: "1px solid #e6dcc6",
        borderRadius: 18,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        display: "block",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        transitionDelay: `${index * STAGGER_MS}ms`,
      }}
    >
      <VitrineImage coverUrl={m.coverUrl} logoUrl={m.logoUrl} height={150}>
        {m.categoryLabel && (
          <span style={{ position: "absolute", top: 12, left: 12, background: "#9a6638", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>
            {m.categoryLabel}
          </span>
        )}
      </VitrineImage>
      <div style={{ padding: "16px 18px 18px" }}>
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: "0 0 5px", color: "#26201a" }}>
          {m.name}
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#8c8068", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {m.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#6c6150" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.accent ?? "#E0A63C" }} />
          {[m.address, m.city].filter(Boolean).join(" · ")}
        </div>
      </div>
    </Link>
  );
}

export function MembersCarousel({ members }: { members: CarouselMember[] }) {
  const [start, setStart] = useState(0);
  const [visible, setVisible] = useState(true);

  const total = members.length;
  const canRotate = total > VISIBLE;

  useEffect(() => {
    if (!canRotate) return;

    const tick = setInterval(() => {
      // Disparition une à une, puis changement, puis réapparition une à une.
      setVisible(false);
      const outMs = FADE_MS + STAGGER_MS * (VISIBLE - 1);
      setTimeout(() => {
        setStart((s) => (s + VISIBLE) % total);
        setVisible(true);
      }, outMs);
    }, INTERVAL_MS);

    return () => clearInterval(tick);
  }, [canRotate, total]);

  if (total === 0) return null;

  // Fenêtre de 3 cartes, avec bouclage propre si on dépasse la fin.
  const shown = Array.from({ length: Math.min(VISIBLE, total) }, (_, i) => members[(start + i) % total]);

  return (
    <div className="grid grid-3" style={{ gap: 18 }}>
      {shown.map((m, i) => (
        <Card key={i} m={m} visible={visible} index={i} />
      ))}
    </div>
  );
}
