"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageField } from "@/components/ImageField";
import { richTextNodes } from "@/lib/rich-text";
import { saveInformation } from "../actions";

/**
 * Rédaction d'une information.
 *
 * Pas d'éditeur WYSIWYG : un `<textarea>` et des boutons qui encadrent la
 * sélection, plus un aperçu rendu par **le même** analyseur que le site
 * (`richTextNodes`). L'aperçu est donc fidèle par construction, et rien de ce
 * qui est saisi ne peut devenir du HTML.
 */

type Draft = {
  id: number | null;
  title: string;
  body: string;
  imageUrl: string | null;
  pinned: boolean;
};

const TOOLS = [
  { label: "B", title: "Gras", before: "**", after: "**", sample: "texte en gras", strong: true },
  { label: "I", title: "Italique", before: "*", after: "*", sample: "texte en italique", italic: true },
  { label: "Titre", title: "Sous-titre", before: "## ", after: "", sample: "Sous-titre", line: true },
  { label: "• liste", title: "Liste à puces", before: "- ", after: "", sample: "premier point", line: true },
  { label: "1. liste", title: "Liste numérotée", before: "1. ", after: "", sample: "première étape", line: true },
  { label: "Lien", title: "Lien", before: "[", after: "](https://)", sample: "libellé du lien" },
] as const;

export function InformationForm({ draft }: { draft: Draft }) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [pinned, setPinned] = useState(draft.pinned);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Remonte le formulaire après une création : `ImageField` n'est pas contrôlé,
  // seul un changement de clé le remet à vide.
  const [round, setRound] = useState(0);

  function applyTool(tool: (typeof TOOLS)[number]) {
    const field = bodyRef.current;
    if (!field) return;
    const { selectionStart, selectionEnd } = field;
    const selected = field.value.slice(selectionStart, selectionEnd) || tool.sample;
    // `setRangeText` conserve la pile d'annulation du navigateur, ce qu'une
    // réécriture complète de la valeur ferait perdre.
    const insert = "line" in tool && tool.line && selectionStart > 0 && field.value[selectionStart - 1] !== "\n";
    field.setRangeText(`${insert ? "\n" : ""}${tool.before}${selected}${tool.after}`, selectionStart, selectionEnd, "select");
    field.focus();
    setBody(field.value);
  }

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

      <label className="field-label" htmlFor="information-body">Message</label>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap",
          border: "1px solid #ddd2bb", borderBottom: "none", borderRadius: "10px 10px 0 0",
          background: "#fff", padding: "6px 7px",
        }}
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.title}
            onClick={() => applyTool(tool)}
            style={{
              minWidth: 30, height: 28, padding: "0 9px", borderRadius: 7, border: "none", background: "transparent",
              color: "#6c6150", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              fontStyle: "italic" in tool && tool.italic ? "italic" : undefined,
            }}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <textarea
        id="information-body"
        ref={bodyRef}
        className="field"
        name="body"
        rows={10}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={"Rédigez ici. Laissez une ligne vide entre deux paragraphes.\n\n- une puce\n**du gras**, [un lien](https://pleinr.fr)"}
        style={{ borderRadius: "0 0 10px 10px", resize: "vertical", lineHeight: 1.7 }}
      />
      <p className="field-hint" style={{ marginTop: 6 }}>
        Mise en forme simple : <strong>**gras**</strong>, <em>*italique*</em>, <code>- puce</code>,{" "}
        <code>[libellé](https://…)</code>. Les liens s&apos;ouvrent dans un nouvel onglet.
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

      {body.trim() && (
        <div style={{ marginTop: 18, borderTop: "1px solid #f0e8d6", paddingTop: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, marginBottom: 10 }}>
            Aperçu
          </div>
          <div style={{ background: "#faf7ef", border: "1px solid #e6dcc6", borderRadius: 12, padding: "14px 16px" }}>
            <h3 className="font-display" style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 17, color: "#26201a" }}>
              {title || "Sans titre"}
            </h3>
            <div className="rich-text">{richTextNodes(body)}</div>
          </div>
        </div>
      )}

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
