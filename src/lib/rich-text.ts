import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/**
 * Sous-ensemble de Markdown pour les informations de l'association.
 *
 * Module **pur**, verrouillé par `tests/rich-text.test.ts`, bâti sur le même
 * principe que `src/lib/activity.ts` : on ne stocke jamais de HTML et on ne
 * rend jamais de HTML brut. Le texte saisi est analysé ici, puis rendu en
 * éléments React côté site — ce que React échappe. Un éditeur WYSIWYG
 * produirait du HTML, qu'il faudrait stocker puis assainir : deuxième
 * dépendance, deuxième surface d'attaque.
 *
 * Grammaire : `**gras**`, `*italique*`, `- puce`, `1. numéro`,
 * `[texte](https://…)`, `## sous-titre`, ligne vide = paragraphe.
 * Un saut de ligne simple reste un saut de ligne.
 *
 * Deux rendus, un seul analyseur : `richTextNodes()` pour l'écran,
 * `richTextToEmailHtml()` pour le message. L'aperçu du formulaire passe par
 * `richTextNodes()`, il est donc fidèle par construction.
 */

export type Inline =
  | { kind: "text"; value: string }
  | { kind: "break" }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "heading"; children: Inline[] }
  | { kind: "bullets"; items: Inline[][] }
  | { kind: "ordered"; items: Inline[][] };

/**
 * Seuls `http:` et `https:` passent. Un `javascript:` ou un `data:` rendrait
 * exécutable un lien écrit par un tiers ; il est rendu comme du texte.
 */
export function safeHttpUrl(value: string): string {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) nodes.push({ kind: "text", value: buffer });
    buffer = "";
  };

  while (index < text.length) {
    // `**` avant `*` : sans cet ordre, « **gras** » serait lu comme un
    // italique vide suivi du mot.
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end > index + 2) {
        flush();
        nodes.push({ kind: "strong", children: parseInline(text.slice(index + 2, end)) });
        index = end + 2;
        continue;
      }
    }
    if (text[index] === "*") {
      const end = text.indexOf("*", index + 1);
      if (end > index + 1) {
        flush();
        nodes.push({ kind: "em", children: parseInline(text.slice(index + 1, end)) });
        index = end + 1;
        continue;
      }
    }
    if (text[index] === "[") {
      const close = text.indexOf("]", index + 1);
      if (close > index && text[close + 1] === "(") {
        const paren = text.indexOf(")", close + 2);
        if (paren > close + 1) {
          const label = text.slice(index + 1, close);
          const href = safeHttpUrl(text.slice(close + 2, paren));
          flush();
          // Lien refusé : le libellé reste, la cible disparaît.
          if (href) nodes.push({ kind: "link", href, children: parseInline(label) });
          else nodes.push(...parseInline(label));
          index = paren + 1;
          continue;
        }
      }
    }
    buffer += text[index];
    index += 1;
  }

  flush();
  return nodes;
}

function parseInlineLines(lines: string[]): Inline[] {
  const nodes: Inline[] = [];
  lines.forEach((line, index) => {
    if (index > 0) nodes.push({ kind: "break" });
    nodes.push(...parseInline(line.trim()));
  });
  return nodes;
}

export function parseRichText(source: string): Block[] {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", children: parseInlineLines(paragraph) });
    paragraph = [];
  };

  const pushItem = (kind: "bullets" | "ordered", item: Inline[]) => {
    flushParagraph();
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind) last.items.push(item);
    else blocks.push({ kind, items: [item] } as Block);
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", children: parseInline(heading[1].trim()) });
      continue;
    }

    // L'espace après le tiret est obligatoire : « *italique* » en début de
    // ligne ne doit pas devenir une puce.
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      pushItem("bullets", parseInline(bullet[1].trim()));
      continue;
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      pushItem("ordered", parseInline(ordered[1].trim()));
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

// ---- Rendu écran ----

function inlineNodes(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "break":
        return createElement("br", { key: index });
      case "strong":
        return createElement("strong", { key: index }, inlineNodes(node.children));
      case "em":
        return createElement("em", { key: index }, inlineNodes(node.children));
      case "link":
        return createElement(
          "a",
          { key: index, href: node.href, target: "_blank", rel: "noopener noreferrer" },
          inlineNodes(node.children),
        );
      default:
        return createElement(Fragment, { key: index }, node.value);
    }
  });
}

/**
 * Rend le texte en nœuds React. Rien n'est jamais passé à
 * `dangerouslySetInnerHTML` : une balise écrite dans la saisie s'affiche
 * littéralement au lieu d'être interprétée.
 */
export function richTextNodes(source: string): ReactNode {
  return parseRichText(source).map((block, index) => {
    switch (block.kind) {
      case "heading":
        return createElement("h4", { key: index }, inlineNodes(block.children));
      case "bullets":
        return createElement(
          "ul",
          { key: index },
          block.items.map((item, position) => createElement("li", { key: position }, inlineNodes(item))),
        );
      case "ordered":
        return createElement(
          "ol",
          { key: index },
          block.items.map((item, position) => createElement("li", { key: position }, inlineNodes(item))),
        );
      default:
        return createElement("p", { key: index }, inlineNodes(block.children));
    }
  });
}

// ---- Rendu e-mail ----

const BODY_STYLE = "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#5d5447;";
const HEADING_STYLE = "font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:26px;color:#26201a;";

function esc(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "break":
          return "<br>";
        case "strong":
          return `<strong style="color:#26201a;">${inlineHtml(node.children)}</strong>`;
        case "em":
          return `<em>${inlineHtml(node.children)}</em>`;
        case "link":
          return `<a href="${esc(node.href)}" target="_blank" style="color:#2C6FB3;">${inlineHtml(node.children)}</a>`;
        default:
          return esc(node.value);
      }
    })
    .join("");
}

/**
 * HTML à styles en ligne pour le gabarit d'e-mail. Sûr parce que le seul
 * producteur est l'analyseur ci-dessus : aucune balise de la saisie n'arrive
 * jusqu'ici, tout passe par `esc()`.
 */
export function richTextToEmailHtml(source: string): string {
  return parseRichText(source)
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<div style="${HEADING_STYLE}margin:0 0 12px;">${inlineHtml(block.children)}</div>`;
        case "bullets":
        case "ordered": {
          const tag = block.kind === "bullets" ? "ul" : "ol";
          const items = block.items.map((item) => `<li style="margin-bottom:4px;">${inlineHtml(item)}</li>`).join("");
          return `<${tag} style="${BODY_STYLE}margin:0 0 18px;padding-left:22px;">${items}</${tag}>`;
        }
        default:
          return `<div style="${BODY_STYLE}margin:0 0 18px;">${inlineHtml(block.children)}</div>`;
      }
    })
    .join("");
}

// ---- Rendus texte ----

function inlinePlain(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "break":
          return "\n";
        case "link": {
          const label = inlinePlain(node.children);
          return label === node.href ? node.href : `${label} (${node.href})`;
        }
        case "strong":
        case "em":
          return inlinePlain(node.children);
        default:
          return node.value;
      }
    })
    .join("");
}

/** Repli `text/plain` du message : même contenu, sans balisage. */
export function richTextToPlain(source: string): string {
  return parseRichText(source)
    .map((block) => {
      switch (block.kind) {
        case "bullets":
          return block.items.map((item) => `- ${inlinePlain(item)}`).join("\n");
        case "ordered":
          return block.items.map((item, index) => `${index + 1}. ${inlinePlain(item)}`).join("\n");
        default:
          return inlinePlain(block.children);
      }
    })
    .join("\n\n");
}

/** Résumé d'une ligne, pour les listes du back-office. */
export function richTextExcerpt(source: string, max = 160): string {
  const plain = richTextToPlain(source).replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
