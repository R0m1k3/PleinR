import type { CSSProperties } from "react";

export function Sparkle({
  color,
  size,
  style,
  duration = 3.2,
  delay = 0,
}: {
  color: string;
  size: number;
  style?: CSSProperties;
  duration?: number;
  delay?: number;
}) {
  return (
    <span
      aria-hidden
      className="sparkle twinkle"
      style={{
        position: "absolute",
        width: size,
        height: size,
        background: color,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        ...style,
      }}
    />
  );
}
