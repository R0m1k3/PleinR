"use client";

import type { Audience } from "@/lib/mail-recipients";

/**
 * Choix des destinataires, partagé par le studio de composition et le
 * composeur d'invitations.
 *
 * Les effectifs sont calculés côté serveur et passés en props : le navigateur
 * n'a jamais besoin de la liste des adresses pour afficher un compteur.
 */

export type RecipientChoices = {
  all: number;
  categories: { value: string; label: string; count: number }[];
  meeting?: { id: number; title: string; count: number } | null;
};

export type AudienceState = { kind: Audience["kind"]; categoryId: string };

export function audienceFrom(state: AudienceState, meetingId?: number | null): Audience {
  if (state.kind === "category" && state.categoryId) {
    return { kind: "category", categoryId: Number(state.categoryId) };
  }
  if (state.kind === "meeting" && meetingId) return { kind: "meeting", meetingId };
  return { kind: "all" };
}

export function audienceCount(state: AudienceState, choices: RecipientChoices): number {
  if (state.kind === "category") {
    return choices.categories.find((option) => option.value === state.categoryId)?.count ?? 0;
  }
  if (state.kind === "meeting") return choices.meeting?.count ?? 0;
  return choices.all;
}

export function MailRecipientPicker({
  choices,
  value,
  onChange,
}: {
  choices: RecipientChoices;
  value: AudienceState;
  onChange: (next: AudienceState) => void;
}) {
  const options: { kind: Audience["kind"]; label: string; hint: string; count: number }[] = [
    { kind: "all", label: "Tous les adhérents actifs", hint: "", count: choices.all },
  ];
  if (choices.categories.length > 0) {
    options.push({ kind: "category", label: "Une catégorie de métier", hint: "", count: 0 });
  }
  if (choices.meeting) {
    options.push({
      kind: "meeting",
      label: "Les inscrits à cette rencontre",
      hint: choices.meeting.title,
      count: choices.meeting.count,
    });
  }

  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
      <legend className="field-label" style={{ marginBottom: 8 }}>Destinataires</legend>
      <div style={{ display: "grid", gap: 9 }}>
        {options.map((option) => (
          <div key={option.kind}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 13.5, color: "#3c3322" }}>
              <input
                type="radio"
                name="audience"
                checked={value.kind === option.kind}
                onChange={() => onChange({ ...value, kind: option.kind })}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong style={{ color: "#26201a" }}>{option.label}</strong>
                {option.kind !== "category" && (
                  <span style={{ color: "#9a8d72" }}> · {option.count} adresse{option.count > 1 ? "s" : ""}</span>
                )}
                {option.hint && <span style={{ display: "block", color: "#9a8d72", fontSize: 12.5 }}>{option.hint}</span>}
              </span>
            </label>

            {option.kind === "category" && value.kind === "category" && (
              <select
                className="field"
                value={value.categoryId}
                onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
                style={{ marginTop: 8, marginLeft: 27, width: "calc(100% - 27px)" }}
              >
                <option value="">Choisir un métier…</option>
                {choices.categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label} ({category.count})
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
