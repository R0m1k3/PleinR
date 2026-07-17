"use client";

import { useState } from "react";

export function PastMeetingGallery({
  title,
  photos,
}: {
  title: string;
  photos: { id: number; imageUrl: string; caption: string | null }[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const current = open == null ? null : photos.find((photo) => photo.id === open);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 14 }}>
        {photos.slice(0, 4).map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpen(photo.id)}
            aria-label={`Ouvrir photo ${index + 1}`}
            style={{
              position: "relative",
              border: "none",
              padding: 0,
              aspectRatio: "1 / 1",
              borderRadius: 8,
              overflow: "hidden",
              cursor: "pointer",
              background: `center/cover no-repeat url(${photo.imageUrl})`,
            }}
          >
            {index === 3 && photos.length > 4 && (
              <span style={{ position: "absolute", inset: 0, background: "rgba(19,50,79,0.62)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                +{photos.length - 3}
              </span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie ${title}`}
          onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(19,50,79,0.72)", zIndex: 80, padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(event) => event.stopPropagation()} style={{ maxWidth: 980, width: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.imageUrl} alt={current.caption ?? title} style={{ width: "100%", maxHeight: "78vh", objectFit: "contain", background: "#fff", borderRadius: 12 }} />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700 }}>{current.caption ?? title}</div>
              <button type="button" onClick={() => setOpen(null)} style={{ border: "none", background: "#fff", color: "#13324F", borderRadius: 999, padding: "9px 16px", fontWeight: 800, cursor: "pointer" }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
