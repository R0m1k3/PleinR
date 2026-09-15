"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageField } from "@/components/ImageField";
import { RichTextEditor } from "@/components/RichTextEditor";
import { saveInformation } from "../actions";

/**
 * Rédaction d'une information.
 *
 * L'édition est **visuelle** : on sélectionne, on clique sur « G », le texte
 * devient gras à l'écran. Aucune syntaxe n'est montrée — un rédacteur
 * d'association n'a pas à connaître Markdown.
 *
 * Ce qui est enregistré reste malgré tout le format balisé restreint : c'est
 * `RichTextEditor` qui resérialise à chaque frappe. Aucun HTML tiers n'atteint
 * la base, et l'éditeur est son propre aperçu — il n'y a plus deux rendus à
 * comparer.
 */

type Draft = {
  id: number | null;
  title: string;
  body: string;
  imageUrl: string | null;
  pinned: boolean;
};

export function InformationForm({ draft }: { draft: Draft }) {
  const router = useRouter();
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [pinned, setPinned] = useState(draft.pinned);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Remonte le formulaire après une création : `ImageField` n'est pas contrôlé,
  // seul un changement de clé le remet à vide.
  const [round, setRound] = useState(0);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    const result = await saveInformation(formData);
    setSaving(false);
    if (result && "error" in result) {
      // Refus de saisie : le formulaire reste ouvert avec ce qui a été écrit.
      setError(result.error);
      return;
    }
    if (draft.id) {
      router.push("/backend/informations");
    } else {
      setTitle("");
      setBody("");
      setPinned(false);
      setRound((value) => value + 1);
    }
    router.refresh();
  }

  return (
    <form key={round} action={submit} style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 14, padding: "20px 22px" }}>
      {draft.id && <input type="hidden" name="id" value={draft.id} />}

      <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, marginBottom: 14 }}>
        {draft.id ? "Modifier l'information" : "Nouvelle information"}
      </div>

      <label className="field-label" htmlFor="information-title">Titre</label>
      <input
        id="information-title"
        className="field"
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={200}
        placeholder="Assemblée générale — mardi 14 octobre, 19 h"
        style={{ marginBottom: 15, fontWeight: 700 }}
      />

      <label className="field-label" id="information-body-label">Message</label>
      <RichTextEditor
        value={draft.body}
        onChange={setBody}
        ariaLabel="Message de l'information"
        placeholder="Rédigez votre message. Sélectionnez du texte puis cliquez sur G pour le mettre en gras."
      />
      {/* Le format balisé ne se montre pas : il voyage dans un champ caché. */}
      <input type="hidden" name="body" value={body} />
      <p className="field-hint" style={{ marginTop: 6 }}>
        Gras, italique, sous-titres, listes et liens. Le collage depuis un traitement de texte
        conserve la mise en forme reconnue et laisse tomber le reste.
      </p>

      <div style={{ marginTop: 16 }}>
        <ImageField name="imageUrl" label="Image (facultative)" defaultValue={draft.imageUrl ?? ""} height={150} />
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}>
        <input type="checkbox" name="pinned" checked={pinned} onChange={(event) => setPinned(event.target.checked)} style={{ marginTop: 3 }} />
        <span>
          <strong style={{ fontSize: 13.5, color: "#26201a" }}>Épingler en tête de l&apos;espace adhérent</strong>
          <span className="field-hint" style={{ display: "block" }}>
            Une seule information à la fois : celle déjà épinglée redescend dans le fil.
          </span>
        </span>
      </label>

      {error && (
        <div role="alert" style={{ marginTop: 14, color: "#d8472b", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={saving}
          style={{ border: "none", background: "#13324F", color: "#fff", fontWeight: 800, fontSize: 13.5, padding: "12px 20px", borderRadius: 10, cursor: saving ? "progress" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Enregistrement…" : draft.id ? "Enregistrer les modifications" : "Enregistrer le brouillon"}
        </button>
        {draft.id && (
          <Link
            href="/backend/informations"
            style={{ border: "1px solid #d8cdb4", background: "#fff", color: "#6c6150", fontWeight: 700, fontSize: 13.5, padding: "12px 18px", borderRadius: 10, textDecoration: "none" }}
          >
            Annuler
          </Link>
        )}
      </div>
    </form>
  );
}
