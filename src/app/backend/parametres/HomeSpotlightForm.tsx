"use client";

import { startTransition, useActionState, useState } from "react";
import { ImageField } from "@/components/ImageField";
import { SPOTLIGHT_NAME_MAX, SPOTLIGHT_TEXT_MAX } from "@/lib/spotlights";
import type { SpotlightSlot } from "@/lib/queries";
import { saveHomeSpotlight } from "../actions";

/**
 * Un emplacement du carrousel de l'accueil.
 *
 * Envoi par `onSubmit` et non par `action={…}` : React réinitialise un
 * formulaire après son action, ce qui décochait « Publier » après une erreur
 * renvoyée. Les champs restent contrôlés pour garder la saisie.
 */
export function HomeSpotlightForm({ spotlight }: { spotlight: SpotlightSlot }) {
  const [state, formAction, pending] = useActionState(saveHomeSpotlight, undefined);
  const [published, setPublished] = useState(spotlight.published);
  const [name, setName] = useState(spotlight.name);
  const [text, setText] = useState(spotlight.text);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      style={{ border: "1px solid #efe6d2", borderRadius: 14, padding: 18, background: "#fdfbf6", display: "grid", gap: 12 }}
    >
      <input type="hidden" name="slot" value={spotlight.slot} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <strong className="font-display" style={{ fontSize: 16, color: "#26201a" }}>
          Entreprise {spotlight.slot}
        </strong>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#3c3322", cursor: "pointer" }}>
          <input
            type="checkbox"
            name="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Publier sur l&apos;accueil
        </label>
      </div>

      <div>
        <label className="field-label">Nom de l&apos;entreprise</label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={SPOTLIGHT_NAME_MAX}
          className="field"
        />
      </div>

      <div>
        <label className="field-label">Présentation</label>
        <textarea
          name="text"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={SPOTLIGHT_TEXT_MAX}
          className="field"
          placeholder="Ce que fait l'entreprise, ce qui la rend unique, où la trouver…"
        />
        <div style={{ textAlign: "right", fontSize: 12, color: "#a99c82" }}>
          {text.length} / {SPOTLIGHT_TEXT_MAX}
        </div>
      </div>

      <ImageField name="imageUrl" label="Photo" defaultValue={spotlight.imageUrl ?? ""} height={150} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            border: "none",
            background: "#13324F",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13.5,
            padding: "10px 16px",
            borderRadius: 9,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Enregistrement…" : `Enregistrer l'entreprise ${spotlight.slot}`}
        </button>
        {state?.ok && !pending && (
          <span style={{ color: "#1f8a5b", fontSize: 13, fontWeight: 600 }}>Enregistré.</span>
        )}
        {state?.error && !pending && (
          <span role="alert" style={{ color: "#d8472b", fontSize: 13, fontWeight: 600 }}>
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
