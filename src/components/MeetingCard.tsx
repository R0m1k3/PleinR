"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/Modal";

/**
 * Carte d'une rencontre à venir, de hauteur identique à ses voisines.
 *
 * Le texte d'une rencontre est libre : une description longue étirait sa carte,
 * donc toute la rangée de la grille, et laissait les autres avec un grand vide
 * sous leur bouton. Titre et description occupent désormais une hauteur figée
 * et sont tronqués en fin de ligne ; le texte complet reste lisible dans une
 * fenêtre ouverte par « Voir le détail ».
 *
 * Les dates arrivent **déjà formatées** depuis la page serveur : les formater
 * ici les rendrait dans le fuseau du visiteur, différent de celui du serveur,
 * et provoquerait une erreur d'hydratation.
 */

export type UpcomingMeetingCardData = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  imageUrl: string | null;
  /** « vendredi 3 octobre 2026 ». */
  dateLabel: string;
  /** « 18:30 ». */
  timeLabel: string;
  capacity: number;
  registered: number;
  participantsPerAccount: number;
  isRegistered: boolean;
  /** Libellé du bouton d'inscription, décidé côté serveur (session, places). */
  ctaLabel: string;
};

const STRIPE =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

/**
 * Hauteurs figées des deux blocs de texte, même principe que `MemberCard` :
 * elles alignent les cartes quel que soit le texte saisi par le staff.
 */
const TITLE_FONT = 21;
const TITLE_LINE = 1.25;
const TITLE_LINES = 2;
const DESC_FONT = 13.5;
const DESC_LINE = 1.6;
const DESC_LINES = 3;

const clampLines = (lines: number) =>
  ({
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  }) as const;

export function MeetingCard({ meeting }: { meeting: UpcomingMeetingCardData }) {
  const [open, setOpen] = useState(false);

  const remaining = Math.max(0, meeting.capacity - meeting.registered);
  const full = remaining <= 0 && !meeting.isRegistered;
  const perAccount = `Jusqu'à ${meeting.participantsPerAccount} participant${meeting.participantsPerAccount > 1 ? "s" : ""} par compte`;
  const cover = meeting.imageUrl ? `center/cover no-repeat url(${meeting.imageUrl})` : STRIPE;

  return (
    <article
      id={`rencontre-${meeting.id}`}
      className="lift"
      style={{
        background: "#fff",
        border: meeting.isRegistered ? "2px solid #1f8a5b" : "1px solid #e6dcc6",
        borderRadius: 12,
        overflow: "hidden",
        scrollMarginTop: 100,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 10", background: cover, flexShrink: 0 }}>
        {meeting.isRegistered && (
          <span style={{ position: "absolute", top: 12, right: 12, display: "inline-flex", alignItems: "center", gap: 6, background: "#1f8a5b", color: "#fff", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 800, boxShadow: "0 4px 14px rgba(22,72,49,0.28)" }}>
            ✓ Inscrit
          </span>
        )}
      </div>

      <div style={{ padding: 18, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800 }}>
          {meeting.dateLabel} · {meeting.timeLabel}
        </div>

        <h3
          className="font-display"
          style={{
            margin: "7px 0 7px",
            color: "#26201a",
            fontSize: TITLE_FONT,
            lineHeight: TITLE_LINE,
            height: TITLE_FONT * TITLE_LINE * TITLE_LINES,
            ...clampLines(TITLE_LINES),
          }}
        >
          {meeting.title}
        </h3>

        {/* Le lieu est facultatif : sa ligne est réservée dans tous les cas,
            sinon une carte sans lieu remonterait tout son bas. */}
        <div
          style={{
            fontSize: 13,
            color: "#6c6150",
            fontWeight: 700,
            height: 13 * 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {meeting.location}
        </div>

        <p
          style={{
            color: "#8c8068",
            fontSize: DESC_FONT,
            lineHeight: DESC_LINE,
            height: DESC_FONT * DESC_LINE * DESC_LINES,
            margin: "8px 0 0",
            ...clampLines(DESC_LINES),
          }}
        >
          {meeting.description}
        </p>

        {/* Espaceur : colle le bas de carte au bas du cadre, quelle que soit la
            hauteur imposée par la plus haute carte de la rangée. */}
        <div style={{ flex: 1, minHeight: 12 }} />

        <div style={{ display: "flex", justifyContent: "space-between", color: "#6c6150", fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>
          <span>{meeting.registered}/{meeting.capacity} inscrits</span>
          <span>{remaining} place(s)</span>
        </div>
        <div style={{ color: "#8c8068", fontSize: 12.5, marginBottom: 10 }}>{perAccount}</div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ flex: "0 0 auto", border: "1px solid #d6c9ad", background: "#fff", color: "#6f6450", borderRadius: 8, padding: "11px 14px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}
          >
            Voir le détail
          </button>
          <Link
            href={`/inscription/${meeting.id}`}
            style={{ flex: 1, textAlign: "center", textDecoration: "none", background: full ? "#a99c82" : "#13324F", color: "#fff", borderRadius: 8, padding: 11, fontWeight: 800 }}
          >
            {meeting.ctaLabel}
          </Link>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={meeting.title} maxWidth={560}>
        {meeting.imageUrl && (
          <div style={{ aspectRatio: "16 / 10", background: cover, borderRadius: 12, marginBottom: 16 }} />
        )}

        <div style={{ color: "#9a6638", fontSize: 13, fontWeight: 800 }}>
          {meeting.dateLabel} · {meeting.timeLabel}
        </div>
        {meeting.location && (
          <div style={{ fontSize: 13.5, color: "#6c6150", fontWeight: 700, marginTop: 4 }}>{meeting.location}</div>
        )}

        {meeting.description && (
          <p style={{ color: "#6c6150", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line", margin: "14px 0 0" }}>
            {meeting.description}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, background: "#faf7ef", border: "1px solid #f0e8d6", borderRadius: 12, padding: "12px 14px", margin: "18px 0 6px", fontSize: 13, fontWeight: 800, color: "#6c6150" }}>
          <span>{meeting.registered}/{meeting.capacity} inscrits</span>
          <span>{remaining} place(s) restante(s)</span>
        </div>
        <div style={{ color: "#8c8068", fontSize: 12.5, marginBottom: 16 }}>{perAccount}</div>

        <Link
          href={`/inscription/${meeting.id}`}
          style={{ display: "block", textAlign: "center", textDecoration: "none", background: full ? "#a99c82" : "#13324F", color: "#fff", borderRadius: 8, padding: 12, fontWeight: 800 }}
        >
          {meeting.ctaLabel}
        </Link>
      </Modal>
    </article>
  );
}
