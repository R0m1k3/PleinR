import { safeHttpUrl } from "@/lib/rich-text";

/**
 * Conversion d'un contenu édité visuellement vers le format balisé stocké.
 *
 * C'est la pièce qui permet un éditeur « comme dans Word » sans renoncer à
 * l'invariant du produit : ce qui est **stocké** reste le sous-ensemble
 * restreint de `src/lib/rich-text.ts`, jamais du HTML tiers. Le danger n'a
 * jamais été la surface d'édition, mais la base de données — alors le
 * navigateur retraverse ce qu'il a édité et n'en garde que le gras,
 * l'italique, les listes, les sous-titres et les liens. Tout le reste — styles
 * de Word, `<span>`, `<script>`, attributs d'événement — disparaît avant même
 * de quitter la page.
 *
 * Le module est **pur** (`tests/rich-text-dom.test.ts`) : il ne connaît du DOM
 * que `MinimalNode`, ce qui le rend testable sans navigateur.
 */

/** Ce que le sérialiseur a besoin de savoir d'un nœud. */
export type MinimalNode = {
  nodeType: number;
  nodeName: string;
  textContent?: string | null;
  childNodes: ArrayLike<MinimalNode>;
  getAttribute?: (name: string) => string | null;
};

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Éléments qui ouvrent une nouvelle ligne dans le format balisé. */
const BLOCKS = new Set(["P", "DIV", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "SECTION", "ARTICLE"]);

/** Éléments dont le contenu ne doit jamais être lu, même comme texte. */
const DROPPED = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "SVG"]);

type LineKind = "paragraph" | "heading" | "bullet" | "ordered";
type Line = { kind: LineKind; text: string };

function nodeName(node: MinimalNode): string {
  return node.nodeType === ELEMENT_NODE ? String(node.nodeName ?? "").toUpperCase() : "";
}

function children(node: MinimalNode): MinimalNode[] {
  return Array.from(node.childNodes ?? []);
}

/** Texte d'un nœud, espaces insécables de l'éditeur ramenés à des espaces. */
function plain(value: string | null | undefined): string {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\r/g, "");
}

/** Contenu en ligne d'un nœud : gras, italique, liens, sauts de ligne. */
function inline(node: MinimalNode): string {
  if (node.nodeType === TEXT_NODE) return plain(node.textContent);
  if (node.nodeType !== ELEMENT_NODE) return "";

  const name = nodeName(node);
  if (DROPPED.has(name)) return "";
  if (name === "BR") return "\n";

  const inner = children(node).map(inline).join("");
  // Un marqueur autour d'une sélection vide produirait « **** », que
  // l'analyseur relirait comme du texte littéral.
  if (!inner.trim()) return inner;

  if (name === "A") {
    const href = safeHttpUrl(node.getAttribute?.("href") ?? "");
    return href ? `[${inner}](${href})` : inner;
  }

  const style = node.getAttribute?.("style") ?? "";
  let marked = inner;
  // L'italique en premier : le gras l'enveloppe, jamais l'inverse.
  if (isItalic(name, style) && !wrapped(marked, "_")) marked = `_${marked}_`;
  if (isBold(name, style) && !wrapped(marked, "**")) marked = `**${marked}**`;
  return marked;
}

/** Déjà encadré par ce marqueur : ne pas le doubler. */
function wrapped(value: string, marker: string): boolean {
  return value.startsWith(marker) && value.endsWith(marker) && value.length > marker.length * 2;
}

/**
 * Un traitement de texte code souvent le gras en style plutôt qu'en balise :
 * Google Docs écrit `<span style="font-weight:700">`. Sans cela, coller un
 * brouillon rédigé ailleurs perdrait silencieusement toute sa mise en forme.
 *
 * Le style explicite l'emporte sur la balise, parce que Google Docs enveloppe
 * aussi tout le document dans un `<b style="font-weight:normal">` — le prendre
 * au mot mettrait le compte rendu entier en gras.
 */
function isBold(name: string, style: string): boolean {
  if (/font-weight\s*:\s*(normal|[1-5]00)\b/i.test(style)) return false;
  return name === "STRONG" || name === "B" || /font-weight\s*:\s*(bold(er)?|[6-9]00)\b/i.test(style);
}

/**
 * L'italique est marqué par des tirets bas et non des étoiles :
 * « **_gras italique_** » reste lisible par l'analyseur, là où « ***…*** »
 * serait ambigu.
 */
function isItalic(name: string, style: string): boolean {
  if (/font-style\s*:\s*normal\b/i.test(style)) return false;
  return name === "EM" || name === "I" || /font-style\s*:\s*italic\b/i.test(style);
}

function push(lines: Line[], kind: LineKind, text: string) {
  // Les espaces de bord disparaissent, les sauts de ligne internes restent :
  // ce sont eux qui portent les retours à la ligne dans un paragraphe.
  const cleaned = text.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
  if (cleaned) lines.push({ kind, text: cleaned });
}

function walk(node: MinimalNode, lines: Line[], ordered: boolean) {
  let buffer = "";
  const flush = () => {
    push(lines, "paragraph", buffer);
    buffer = "";
  };

  for (const child of children(node)) {
    const name = nodeName(child);

    if (DROPPED.has(name)) continue;

    if (name === "UL" || name === "OL") {
      flush();
      walk(child, lines, name === "OL");
      continue;
    }

    if (name === "LI") {
      flush();
      push(lines, ordered ? "ordered" : "bullet", inline(child));
      continue;
    }

    if (BLOCKS.has(name)) {
      flush();
      // Un `<div>` d'éditeur peut contenir d'autres blocs plutôt que du texte.
      if (children(child).some((grandChild) => {
        const grandName = nodeName(grandChild);
        return BLOCKS.has(grandName) || grandName === "UL" || grandName === "OL";
      })) {
        walk(child, lines, ordered);
      } else {
        push(lines, /^H[1-6]$/.test(name) ? "heading" : "paragraph", inline(child));
      }
      continue;
    }

    // Texte nu et éléments en ligne : ils appartiennent au paragraphe courant.
    buffer += inline(child);
  }

  flush();
}

function isList(kind: LineKind): boolean {
  return kind === "bullet" || kind === "ordered";
}

/**
 * Sérialise un fragment édité vers le format balisé.
 *
 * `root` est typiquement la `<div contenteditable>` de l'éditeur, ou le
 * `body` d'un document inerte produit par `DOMParser` lors d'un collage.
 */
export function serializeToRichText(root: MinimalNode): string {
  const lines: Line[] = [];
  walk(root, lines, false);

  let counter = 0;
  return lines
    .map((line, index) => {
      const previous = lines[index - 1];
      const continues = previous && isList(previous.kind) && previous.kind === line.kind;
      counter = line.kind === "ordered" ? (continues ? counter + 1 : 1) : 0;

      const prefix =
        line.kind === "heading" ? "## " : line.kind === "bullet" ? "- " : line.kind === "ordered" ? `${counter}. ` : "";
      // Les éléments d'une même liste se suivent ; tout le reste est séparé par
      // une ligne vide, qui marque un nouveau paragraphe.
      const separator = index === 0 ? "" : continues ? "\n" : "\n\n";
      return `${separator}${prefix}${line.text}`;
    })
    .join("");
}
