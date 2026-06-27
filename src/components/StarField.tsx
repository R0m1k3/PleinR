import type { CSSProperties } from "react";

type Star = {
  top: string;
  left: string;
  size: number;
  color: string;
  tw: number; // durée scintillement (s)
  dr: number; // durée dérive (s)
  delay: number;
};

// Positions fixes (déterministes) pour éviter tout décalage d'hydratation.
const STARS: Star[] = [
  { top: "8%", left: "6%", size: 16, color: "#E0A63C", tw: 3.1, dr: 9, delay: 0 },
  { top: "18%", left: "22%", size: 10, color: "#6FB0C6", tw: 2.6, dr: 11, delay: 0.6 },
  { top: "12%", left: "44%", size: 13, color: "#9a6638", tw: 3.6, dr: 8, delay: 1.1 },
  { top: "26%", left: "63%", size: 11, color: "#2C6FB3", tw: 2.9, dr: 12, delay: 0.3 },
  { top: "9%", left: "82%", size: 18, color: "#E0A63C", tw: 3.3, dr: 10, delay: 0.9 },
  { top: "40%", left: "12%", size: 12, color: "#2C6FB3", tw: 3.0, dr: 13, delay: 1.4 },
  { top: "52%", left: "33%", size: 9, color: "#E0A63C", tw: 2.7, dr: 9.5, delay: 0.2 },
  { top: "46%", left: "72%", size: 14, color: "#6FB0C6", tw: 3.4, dr: 11.5, delay: 1.7 },
  { top: "62%", left: "52%", size: 10, color: "#9a6638", tw: 2.8, dr: 10.5, delay: 0.5 },
  { top: "70%", left: "18%", size: 13, color: "#E0A63C", tw: 3.2, dr: 12.5, delay: 1.0 },
  { top: "76%", left: "88%", size: 11, color: "#2C6FB3", tw: 3.5, dr: 8.5, delay: 0.7 },
  { top: "84%", left: "40%", size: 15, color: "#6FB0C6", tw: 3.0, dr: 11, delay: 1.3 },
  { top: "33%", left: "90%", size: 9, color: "#9a6638", tw: 2.5, dr: 9, delay: 0.4 },
  { top: "88%", left: "67%", size: 12, color: "#E0A63C", tw: 3.3, dr: 10, delay: 1.6 },
];

export function StarField({ density = 1, style }: { density?: number; style?: CSSProperties }) {
  const stars = STARS.slice(0, Math.max(4, Math.round(STARS.length * density)));
  return (
    <div className="starfield" aria-hidden style={style}>
      {stars.map((s, i) => (
        <span
          key={i}
          className="sparkle star"
          style={
            {
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              background: s.color,
              opacity: 0.7,
              "--tw": `${s.tw}s`,
              "--dr": `${s.dr}s`,
              animationDelay: `${s.delay}s, ${s.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
