"use client";

import { useCallback, useEffect, useState } from "react";
import { ModalShell } from "./ModalShell";

export type PastMeetingPhotoView = { id: number; imageUrl: string; caption: string | null };

export type PastMeetingView = {
  id: number;
  title: string;
  /** Date déjà mise en forme côté serveur : le composant ne refait pas de locale. */
  dateLabel: string;
  location: string | null;
  description: string | null;
  participantCount: number;
  photos: PastMeetingPhotoView[];
};

/**
 * Carte d'une rencontre passée, de hauteur fixe, et sa fenêtre de lecture.
 *
 * La carte ne montre qu'un aperçu — couverture, titre sur deux lignes, trois
 * lignes de texte, compteurs : une rencontre richement racontée et une autre en
 * deux phrases occupent ainsi la même place dans la grille. Le récit complet et
 * la totalité des photos sont dans la fenêtre, où la place ne manque plus.
 */
export function PastMeetingCard({ meeting }: { meeting: PastMeetingView }) {
  const [open, setOpen] = useState(false);
  const cover = meeting.photos[0]?.imageUrl;

  return (
    <article className="pm-card" style={{ position: "relative" }}>
      <div
        className={cover ? "pm-card__cover" : "pm-card__cover pm-card__cover--empty"}
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
      >
        {meeting.photos.length > 0 && (
          <span className="pm-card__count">
            {meeting.photos.length} photo{meeting.photos.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="pm-card__body">
        <div style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800 }}>{meeting.dateLabel}</div>
        <h3 className="font-display pm-card__title">{meeting.title}</h3>
        {meeting.location && (
          <div className="pm-line" style={{ color: "#6c6150", fontSize: 13, fontWeight: 700 }}>{meeting.location}</div>
        )}
        {meeting.description && <p className="pm-card__text">{meeting.description}</p>}
        <div className="pm-card__meta">
          <span>
            {meeting.participantCount} participant{meeting.participantCount > 1 ? "s" : ""}
          </span>
          <span className="pm-card__more">Voir la rencontre →</span>
        </div>
      </div>

      {/* Toute la carte est cliquable, mais un seul élément interactif : le
          titre reste un vrai titre, et la tabulation ne traverse pas la carte. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ouvrir la rencontre : ${meeting.title}`}
        style={{ position: "absolute", inset: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 12 }}
      />

      {open && <PastMeetingModal meeting={meeting} onClose={() => setOpen(false)} />}
    </article>
  );
}

function PastMeetingModal({ meeting, onClose }: { meeting: PastMeetingView; onClose: () => void }) {
  const photos = meeting.photos;
  const [index, setIndex] = useState(0);
  const current = photos[index];

  const move = useCallback(
    (step: number) => {
      if (photos.length === 0) return;
      setIndex((value) => (value + step + photos.length) % photos.length);
    },
    [photos.length],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [move]);

  return (
    <ModalShell
      label={`Rencontre : ${meeting.title}`}
      onClose={onClose}
      panelClassName={photos.length > 0 ? "pm-panel" : "pm-panel pm-panel--form"}
    >
      {photos.length > 0 && (
        <div className="pm-panel__media">
          <div className="pm-panel__stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.imageUrl} alt={current.caption ?? `${meeting.title} — photo ${index + 1}`} />
            {photos.length > 1 && (
              <>
                <button type="button" className="pm-arrow pm-arrow--prev" onClick={() => move(-1)} aria-label="Photo précédente">‹</button>
                <button type="button" className="pm-arrow pm-arrow--next" onClick={() => move(1)} aria-label="Photo suivante">›</button>
              </>
            )}
            <span style={{ position: "absolute", left: 16, bottom: 16, background: "rgba(16,31,46,0.78)", color: "#fff", borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 800 }}>
              {index + 1} / {photos.length}
            </span>
          </div>
          {current.caption && (
            <div style={{ color: "#cfe0ee", fontSize: 13, padding: "0 16px", lineHeight: 1.5 }}>{current.caption}</div>
          )}
          {photos.length > 1 && (
            <div className="pm-thumbs">
              {photos.map((photo, position) => (
                <button
                  key={photo.id}
                  type="button"
                  className={position === index ? "pm-thumb pm-thumb--active" : "pm-thumb"}
                  style={{ backgroundImage: `url(${photo.imageUrl})` }}
                  onClick={() => setIndex(position)}
                  aria-label={`Photo ${position + 1}`}
                  aria-current={position === index}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pm-panel__info">
        <div style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>{meeting.dateLabel}</div>
        <h2 className="font-display" style={{ margin: "8px 0 10px", color: "#26201a", fontSize: 30, lineHeight: 1.15, paddingRight: 34 }}>{meeting.title}</h2>
        {meeting.location && <div style={{ color: "#6c6150", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{meeting.location}</div>}
        <div style={{ color: "#6c6150", fontSize: 12.5, fontWeight: 800, marginBottom: 16 }}>
          {meeting.participantCount} participant{meeting.participantCount > 1 ? "s" : ""}
          {photos.length > 0 && ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}`}
        </div>
        {meeting.description && <p className="pm-body-text">{meeting.description}</p>}
      </div>
    </ModalShell>
  );
}
