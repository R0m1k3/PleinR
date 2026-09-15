"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { richTextToEditorHtml } from "@/lib/rich-text";
import { serializeToRichText } from "@/lib/rich-text-dom";

/**
 * Éditeur visuel : on écrit, on sélectionne, on clique sur **G**, et le texte
 * devient gras à l'écran. Aucune syntaxe à connaître.
 *
 * Ce qui part au serveur reste pourtant le format balisé restreint : à chaque
 * frappe, `serializeToRichText` retraverse le contenu édité et n'en garde que
 * le gras, l'italique, les listes, les sous-titres et les liens. Le HTML de
 * l'éditeur ne quitte jamais la page — c'était là, et non dans l'édition
 * visuelle, que se trouvait le risque.
 *
 * `document.execCommand` est officiellement déprécié mais reste implémenté par
 * tous les navigateurs, et c'est la seule façon d'obtenir une édition riche
 * sans embarquer un moteur d'édition complet. Le jour où il faudrait en
 * changer, seul ce fichier bougerait : le contrat de stockage est le
 * sérialiseur, pas l'éditeur.
 */

type Tool = {
  key: string;
  label: string;
  title: string;
  command: string;
  argument?: string;
  /** Nom d'état interrogé pour allumer le bouton quand le curseur est dedans. */
  state?: string;
  render?: "bold" | "italic";
};

const TOOLS: Tool[] = [
  { key: "bold", label: "G", title: "Gras (Ctrl+B)", command: "bold", state: "bold", render: "bold" },
  { key: "italic", label: "I", title: "Italique (Ctrl+I)", command: "italic", state: "italic", render: "italic" },
  { key: "h4", label: "Sous-titre", title: "Transformer la ligne en sous-titre", command: "formatBlock", argument: "<h4>" },
  { key: "ul", label: "Liste à puces", title: "Liste à puces", command: "insertUnorderedList", state: "insertUnorderedList" },
  { key: "ol", label: "Liste numérotée", title: "Liste numérotée", command: "insertOrderedList", state: "insertOrderedList" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Rédigez votre message…",
  ariaLabel = "Message",
}: {
  value: string;
  onChange: (markup: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const savedRange = useRef<Range | null>(null);

  const sync = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.dataset.empty = String(editor.textContent?.trim().length === 0);
    onChange(serializeToRichText(editor));
  }, [onChange]);

  // Contenu initial posé une seule fois : réécrire le HTML à chaque frappe
  // replacerait le curseur au début de la zone.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = richTextToEditorHtml(value);
    editor.dataset.empty = String(editor.textContent?.trim().length === 0);
    try {
      // Sans cela, Chrome écrit `<span style="font-weight:bold">` au lieu de
      // `<b>` — le sérialiseur, qui ne lit pas les styles, perdrait le gras.
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* Navigateur sans execCommand : la saisie reste possible, sans mise en forme. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les boutons s'allument selon l'endroit où se trouve le curseur.
  useEffect(() => {
    function refresh() {
      const editor = editorRef.current;
      if (!editor || !editor.contains(document.getSelection()?.anchorNode ?? null)) return;
      const next: Record<string, boolean> = {};
      for (const tool of TOOLS) {
        if (!tool.state) continue;
        try {
          next[tool.key] = document.queryCommandState(tool.state);
        } catch {
          next[tool.key] = false;
        }
      }
      setActive(next);
    }
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, []);

  function run(command: string, argument?: string) {
    editorRef.current?.focus();
    try {
      document.execCommand(command, false, argument);
    } catch {
      /* Commande refusée : on laisse le texte tel quel. */
    }
    sync();
  }

  function applyTool(tool: Tool) {
    // Re-cliquer sur « Sous-titre » revient à un paragraphe ordinaire.
    if (tool.command === "formatBlock" && currentBlock() === "H4") {
      run("formatBlock", "<p>");
      return;
    }
    run(tool.command, tool.argument);
  }

  function currentBlock(): string {
    try {
      return String(document.queryCommandValue("formatBlock") ?? "").toUpperCase();
    } catch {
      return "";
    }
  }

  function openLink() {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setLinkUrl("");
      savedRange.current = null;
      return;
    }
    // La sélection est perdue dès que le champ d'adresse prend le focus :
    // on la met de côté pour la retrouver à la validation.
    savedRange.current = selection.getRangeAt(0).cloneRange();
    setLinkUrl("https://");
  }

  function confirmLink() {
    const url = (linkUrl ?? "").trim();
    setLinkUrl(null);
    if (!url || !savedRange.current) return;

    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedRange.current);
    savedRange.current = null;
    // Une adresse non http(s) est écartée par le sérialiseur : le libellé
    // reste, le lien disparaît.
    run("createLink", url);
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");

    if (html) {
      // Le HTML collé — d'un Word, d'une page web — est analysé dans un
      // document **inerte** : `DOMParser` n'exécute rien et ne charge aucune
      // ressource, contrairement à une affectation d'`innerHTML`. On le
      // repasse ensuite par notre format, donc seule la mise en forme connue
      // survit ; on ne réinjecte que du HTML produit par nous.
      const parsed = new DOMParser().parseFromString(html, "text/html");
      run("insertHTML", richTextToEditorHtml(serializeToRichText(parsed.body)));
      return;
    }
    run("insertText", text);
  }

  return (
    <div>
      <div className="rich-editor-toolbar" role="toolbar" aria-label="Mise en forme">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            title={tool.title}
            aria-pressed={active[tool.key] ?? false}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyTool(tool)}
            className={`rich-editor-tool${active[tool.key] ? " is-active" : ""}`}
            style={{
              fontWeight: tool.render === "bold" ? 800 : undefined,
              fontStyle: tool.render === "italic" ? "italic" : undefined,
            }}
          >
            {tool.label}
          </button>
        ))}
        <span className="rich-editor-separator" />
        <button
          type="button"
          title="Insérer un lien sur le texte sélectionné"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openLink}
          className="rich-editor-tool"
        >
          Lien
        </button>
        <button
          type="button"
          title="Retirer la mise en forme de la sélection"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run("removeFormat")}
          className="rich-editor-tool"
        >
          Effacer la mise en forme
        </button>
      </div>

      {linkUrl !== null && (
        <div className="rich-editor-link">
          {savedRange.current ? (
            <>
              <input
                className="field"
                value={linkUrl}
                autoFocus
                placeholder="https://…"
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmLink();
                  }
                  if (event.key === "Escape") setLinkUrl(null);
                }}
              />
              <button type="button" className="rich-editor-tool" onClick={confirmLink}>Ajouter</button>
              <button type="button" className="rich-editor-tool" onClick={() => setLinkUrl(null)}>Annuler</button>
            </>
          ) : (
            <>
              <span className="field-hint">Sélectionnez d&apos;abord le texte à transformer en lien.</span>
              <button type="button" className="rich-editor-tool" onClick={() => setLinkUrl(null)}>Fermer</button>
            </>
          )}
        </div>
      )}

      <div
        ref={editorRef}
        className="rich-editor rich-text"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        onInput={sync}
        onBlur={sync}
        onPaste={onPaste}
      />
    </div>
  );
}
