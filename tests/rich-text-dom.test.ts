import { test } from "node:test";
import assert from "node:assert/strict";

import { serializeToRichText, type MinimalNode } from "../src/lib/rich-text-dom";
import { parseRichText, richTextToEmailHtml, richTextToPlain } from "../src/lib/rich-text";

/**
 * Faux DOM minimal : le sérialiseur ne connaît du navigateur que `MinimalNode`,
 * ce qui permet de le tester sans jsdom.
 */
function el(name: string, children: MinimalNode[] = [], attributes: Record<string, string> = {}): MinimalNode {
  return {
    nodeType: 1,
    nodeName: name,
    childNodes: children,
    getAttribute: (key: string) => attributes[key] ?? null,
  };
}

function txt(value: string): MinimalNode {
  return { nodeType: 3, nodeName: "#text", textContent: value, childNodes: [] };
}

const root = (...children: MinimalNode[]) => el("DIV", children);

test("un paragraphe simple ressort tel quel", () => {
  assert.equal(serializeToRichText(root(el("P", [txt("Bonjour à tous.")]))), "Bonjour à tous.");
});

test("deux paragraphes sont séparés par une ligne vide", () => {
  const markup = serializeToRichText(root(el("P", [txt("Premier.")]), el("P", [txt("Second.")])));
  assert.equal(markup, "Premier.\n\nSecond.");
  assert.equal(parseRichText(markup).length, 2);
});

test("le gras et l'italique deviennent des marqueurs", () => {
  assert.equal(
    serializeToRichText(root(el("P", [txt("Rendez-vous "), el("STRONG", [txt("mardi")]), txt(" à "), el("EM", [txt("Pompey")])]))),
    "Rendez-vous **mardi** à _Pompey_",
  );
});

test("les balises B et I d'execCommand valent STRONG et EM", () => {
  assert.equal(serializeToRichText(root(el("P", [el("B", [txt("a")]), el("I", [txt("b")])]))), "**a**_b_");
});

test("gras et italique imbriqués se relisent correctement", () => {
  // C'est la raison du tiret bas : « ***x*** » serait ambigu pour l'analyseur.
  const markup = serializeToRichText(root(el("P", [el("STRONG", [el("EM", [txt("très important")])])])));
  assert.equal(markup, "**_très important_**");
  const blocks = parseRichText(markup);
  assert.equal(blocks[0].kind, "paragraph");
  const strong = blocks[0].kind === "paragraph" ? blocks[0].children[0] : null;
  assert.equal(strong?.kind, "strong");
  assert.equal(strong?.kind === "strong" ? strong.children[0].kind : null, "em");
});

test("un saut de ligne dans un paragraphe est conservé", () => {
  const markup = serializeToRichText(root(el("P", [txt("Une ligne"), el("BR"), txt("une autre")])));
  assert.equal(markup, "Une ligne\nune autre");
  assert.equal(parseRichText(markup).length, 1);
});

test("les listes à puces et numérotées prennent leur préfixe", () => {
  assert.equal(
    serializeToRichText(root(el("UL", [el("LI", [txt("un")]), el("LI", [txt("deux")])]))),
    "- un\n- deux",
  );
  assert.equal(
    serializeToRichText(root(el("OL", [el("LI", [txt("a")]), el("LI", [txt("b")]), el("LI", [txt("c")])]))),
    "1. a\n2. b\n3. c",
  );
});

test("la numérotation repart à un sur une seconde liste", () => {
  const markup = serializeToRichText(
    root(
      el("OL", [el("LI", [txt("a")])]),
      el("P", [txt("Entre les deux.")]),
      el("OL", [el("LI", [txt("b")])]),
    ),
  );
  assert.equal(markup, "1. a\n\nEntre les deux.\n\n1. b");
});

test("un titre devient un sous-titre", () => {
  assert.equal(serializeToRichText(root(el("H4", [txt("Ordre du jour")]))), "## Ordre du jour");
  // Les autres niveaux de titre, venus d'un collage, se rabattent sur le même.
  assert.equal(serializeToRichText(root(el("H1", [txt("Collé depuis le web")]))), "## Collé depuis le web");
});

test("un lien http(s) garde sa cible, les autres perdent la leur", () => {
  assert.equal(
    serializeToRichText(root(el("P", [el("A", [txt("le site")], { href: "https://pleinr.fr/" })]))),
    "[le site](https://pleinr.fr/)",
  );
  assert.equal(
    serializeToRichText(root(el("P", [el("A", [txt("piège")], { href: "javascript:alert(1)" })]))),
    "piège",
  );
  assert.equal(serializeToRichText(root(el("P", [el("A", [txt("sans cible")])]))), "sans cible");
});

test("tout ce qui n'est pas reconnu perd sa balise et garde son texte", () => {
  // Couleur, taille, police : rien de tout cela n'existe dans le format stocké.
  const markup = serializeToRichText(
    root(el("P", [el("SPAN", [txt("du texte")], { style: "color:red;font-size:32px" }), el("FONT", [txt(" coloré")], { color: "blue" })])),
  );
  assert.equal(markup, "du texte coloré");
});

test("le contenu exécutable est retiré, texte compris", () => {
  const markup = serializeToRichText(
    root(
      el("SCRIPT", [txt("alert(1)")]),
      el("STYLE", [txt("body{display:none}")]),
      el("P", [txt("Bonjour"), el("IFRAME", [txt("piège")])]),
    ),
  );
  assert.equal(markup, "Bonjour");
  assert.ok(!markup.includes("alert"));
  assert.ok(!markup.includes("display:none"));
});

test("un collage de Word — div imbriqués et styles — se ramène au texte structuré", () => {
  const pasted = root(
    el("DIV", [
      el("P", [el("SPAN", [txt("Compte rendu")], { style: "font-size:24px" })]),
      el("UL", [el("LI", [el("SPAN", [el("B", [txt("Point 1")])])]), el("LI", [txt("Point 2")])]),
    ]),
  );
  assert.equal(serializeToRichText(pasted), "Compte rendu\n\n- **Point 1**\n- Point 2");
});

test("les espaces insécables de l'éditeur redeviennent des espaces", () => {
  assert.equal(serializeToRichText(root(el("P", [txt("19\u00a0h\u00a0précises")]))), "19 h précises");
});

test("une mise en forme appliquée à une sélection vide ne produit pas de marqueur", () => {
  // Chrome laisse un `<b></b>` quand on active le gras sans rien taper.
  assert.equal(serializeToRichText(root(el("P", [el("B", []), txt("texte")]))), "texte");
  assert.ok(!serializeToRichText(root(el("P", [el("B", [txt("  ")]), txt("x")]))).includes("**"));
});

test("un éditeur vide produit une chaîne vide", () => {
  assert.equal(serializeToRichText(root()), "");
  assert.equal(serializeToRichText(root(el("P", [el("BR")]))), "");
  assert.equal(serializeToRichText(root(el("P", [txt("   ")]))), "");
});

test("l'aller-retour édition → stockage → rendu conserve le sens", () => {
  const markup = serializeToRichText(
    root(
      el("H4", [txt("Assemblée générale")]),
      el("P", [txt("Elle se tiendra "), el("STRONG", [txt("salle Jean-Jaurès")]), txt(".")]),
      el("UL", [el("LI", [txt("comptes 2026")]), el("LI", [txt("budget")])]),
      el("P", [el("A", [txt("le compte rendu")], { href: "https://pleinr.fr/association" })]),
    ),
  );

  assert.equal(
    markup,
    "## Assemblée générale\n\nElle se tiendra **salle Jean-Jaurès**.\n\n- comptes 2026\n- budget\n\n[le compte rendu](https://pleinr.fr/association)",
  );

  const html = richTextToEmailHtml(markup);
  assert.ok(html.includes("<strong"));
  assert.ok(html.includes("<ul"));
  assert.ok(html.includes('href="https://pleinr.fr/association"'));
  assert.ok(richTextToPlain(markup).includes("Assemblée générale"));
});

test("le gras codé en style CSS est reconnu — cas Google Docs", () => {
  assert.equal(
    serializeToRichText(root(el("P", [el("SPAN", [txt("important")], { style: "font-weight:700" })]))),
    "**important**",
  );
  assert.equal(
    serializeToRichText(root(el("P", [el("SPAN", [txt("nuance")], { style: "font-style: italic" })]))),
    "_nuance_",
  );
});

test("le style explicite l'emporte sur la balise", () => {
  // Google Docs enveloppe tout le document dans un `<b style="font-weight:normal">`.
  assert.equal(
    serializeToRichText(root(el("B", [el("P", [txt("tout le document")])], { style: "font-weight:normal" }))),
    "tout le document",
  );
});

test("un marqueur n'est jamais doublé", () => {
  assert.equal(
    serializeToRichText(root(el("P", [el("B", [el("SPAN", [txt("x")], { style: "font-weight:bold" })])]))),
    "**x**",
  );
});

test("gras et italique combinés s'imbriquent dans le bon ordre", () => {
  assert.equal(
    serializeToRichText(root(el("P", [el("SPAN", [txt("les deux")], { style: "font-weight:700;font-style:italic" })]))),
    "**_les deux_**",
  );
});
