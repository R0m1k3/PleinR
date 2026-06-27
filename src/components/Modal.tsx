"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(25,20,12,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          border: "1px solid #e6dcc6",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(25,20,12,0.28)",
          padding: "26px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <h2 className="font-display" style={{ fontWeight: 800, fontSize: 22, margin: 0, color: "#26201a" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              border: "none",
              background: "#f1ead9",
              color: "#6f6450",
              width: 34,
              height: 34,
              borderRadius: 10,
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
