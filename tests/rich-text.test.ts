import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseRichText,
  richTextExcerpt,
  richTextNodes,
  richTextToEditorHtml,
  richTextToEmailHtml,
  richTextToPlain,
  safeHttpUrl,
} from "../src/lib/rich-text";

/** Sérialise l'arbre React pour inspecter ce qui a réellement été construit. */
function serialize(source: string) {
  return JSON.stringify(richTextNodes(source));
}

test("les paragraphes sont séparés par une ligne vide", () => {
  const blocks = parseRichText("Premier.\n\nSecond.");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].kind, "paragraph");
  assert.equal(richTextToPlain("Premier.\n\nSecond."), "Premier.\n\nSecond.");
});

test("un saut de ligne simple reste un saut de ligne", () => {
  const blocks = parseRichText("Une ligne\nune autre");
  assert.equal(blocks.length, 1);
  assert.deepEqual(
    blocks[0].kind === "paragraph" ? blocks[0].children.map((c) => c.kind) : [],
    ["text", "break", "text"],
  );
  assert.ok(richTextToEmailHtml("Une ligne\nune autre").includes("<br>"));
});

test("gras et italique sont reconnus, et imbriqués", () => {
  assert.ok(richTextToEmailHtml("**gras**").includes("<strong"));
  assert.ok(richTextToEmailHtml("*doux*").includes("<em>doux</em>"));
  assert.ok(richTextToEmailHtml("**du *doux* dedans**").includes("<em>doux</em>"));
});

test("une étoile non appariée reste littérale", () => {
  assert.equal(richTextToPlain("**gras sans fin"), "**gras sans fin");
  assert.equal(richTextToPlain("2 * 3 = 6"), "2 * 3 = 6");
  assert.ok(!richTextToEmailHtml("**gras sans fin").includes("<strong"));
});

test("les listes à puces et numérotées regroupent leurs lignes", () => {
  const blocks = parseRichText("- un\n- deux\n\n1. a\n2. b");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].kind, "bullets");
  assert.equal(blocks[0].kind === "bullets" ? blocks[0].items.length : 0, 2);
  assert.equal(blocks[1].kind, "ordered");
  const html = richTextToEmailHtml("- un\n- deux");
  assert.equal(html.match(/<li/g)?.length, 2);
  assert.ok(html.startsWith("<ul"));
});

test("un italique en début de ligne n'est pas confondu avec une puce", () => {
  const blocks = parseRichText("*insistons* sur ce point");
  assert.equal(blocks[0].kind, "paragraph");
});

test("un sous-titre devient un bloc à part", () => {
  const blocks = parseRichText("## Ordre du jour\nPremier point");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].kind, "heading");
  assert.ok(richTextToEmailHtml("## Ordre du jour").includes("Georgia"));
});

test("un lien http(s) est rendu, en nouvel onglet et sans fuite d'ouvreur", () => {
  const nodes = serialize("[le site](https://pleinr.fr/promotions)");
  assert.ok(nodes.includes("https://pleinr.fr/promotions"));
  assert.ok(nodes.includes("noopener noreferrer"));
  assert.ok(nodes.includes('"target":"_blank"'));
  assert.ok(richTextToEmailHtml("[le site](https://pleinr.fr)").includes('href="https://pleinr.fr/"'));
});

test("un lien javascript: ou data: perd sa cible et ne garde que son libellé", () => {
  for (const hostile of [
    "[clique ici](javascript:alert(1))",
    "[clique ici](data:text/html,<script>alert(1)</script>)",
    "[clique ici](vbscript:msgbox)",
    "[clique ici](  JavaScript:alert(1)  )",
  ]) {
    const html = richTextToEmailHtml(hostile);
    assert.ok(!html.includes("<a "), `cible conservée pour ${hostile}`);
    assert.ok(!/javascript:/i.test(html), `protocole conservé pour ${hostile}`);
    assert.ok(html.includes("clique ici"), "le libellé doit rester");
  }
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("pas une url"), "");
  assert.equal(safeHttpUrl("https://pleinr.fr"), "https://pleinr.fr/");
});

test("un crochet dans le libellé ne permet pas de sortir du lien", () => {
  const html = richTextToEmailHtml("[a]b](https://pleinr.fr)");
  assert.ok(!html.includes("<a "), "le lien malformé ne doit pas être construit");
  assert.ok(html.includes("[a]b]"));
});

test("le HTML écrit dans la saisie est rendu littéralement", () => {
  const payloads = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    "<svg/onload=alert(1)>",
    '<iframe src="javascript:alert(1)"></iframe>',
    "<ScRiPt>alert(1)</ScRiPt>",
    '<a href="javascript:alert(1)">x</a>',
    "<style>body{display:none}</style>",
  ];
  // Les seules balises que le HTML d'e-mail a le droit de contenir sont
  // celles que l'analyseur construit lui-même.
  const OURS = /<\/?(?:div|strong|em|a|br|ul|ol|li)\b[^>]*>/g;

  for (const payload of payloads) {
    const html = richTextToEmailHtml(payload);
    const leftovers = html.replace(OURS, "");
    assert.ok(!leftovers.includes("<"), `balise conservée : ${payload}`);
    assert.ok(!leftovers.includes(">"), `balise conservée : ${payload}`);
    assert.ok(html.includes("&lt;"), `balise non échappée : ${payload}`);
    // « onerror » survit comme texte échappé, et c'est sain : il n'est plus
    // dans un contexte d'attribut, donc plus exécutable.

    // Côté écran, le texte arrive tel quel dans un nœud React : c'est React
    // qui échappe au rendu, la balise n'est jamais construite.
    const tree = serialize(payload);
    assert.ok(!tree.includes('"type":"script"'), `élément script construit : ${payload}`);
    assert.ok(!tree.includes('"type":"img"'), `élément img construit : ${payload}`);
    assert.ok(!tree.includes("onError"), `gestionnaire construit : ${payload}`);
  }
});

test("le rendu n'emprunte jamais dangerouslySetInnerHTML", () => {
  assert.ok(!serialize("**a** *b* [c](https://d.fr)\n- e\n\n## f").includes("dangerouslySetInnerHTML"));
});

test("les guillemets et esperluettes sont échappés dans le HTML d'e-mail", () => {
  const html = richTextToEmailHtml('Marie & "Paul" <chez eux>');
  assert.ok(html.includes("&amp;"));
  assert.ok(html.includes("&quot;"));
  assert.ok(html.includes("&lt;chez eux&gt;"));
});

test("le repli texte conserve le contenu et explicite les liens", () => {
  assert.equal(
    richTextToPlain("Voir **ici** : [les promos](https://pleinr.fr/promotions)"),
    "Voir ici : les promos (https://pleinr.fr/promotions)",
  );
  assert.equal(richTextToPlain("- un\n- deux"), "- un\n- deux");
  assert.equal(richTextToPlain("1. un\n2. deux"), "1. un\n2. deux");
});

test("le résumé coupe sur un mot et ajoute des points de suspension", () => {
  assert.equal(richTextExcerpt("Court."), "Court.");
  const long = richTextExcerpt("Vingt-deux chalets cette année, du 12 au 21 décembre prochain.", 30);
  assert.ok(long.endsWith("…"));
  assert.ok(long.length <= 31);
  assert.ok(!long.includes("  "));
});

test("une saisie vide ne produit aucun bloc", () => {
  assert.deepEqual(parseRichText(""), []);
  assert.deepEqual(parseRichText("   \n\n  "), []);
  assert.equal(richTextToEmailHtml(""), "");
  assert.equal(richTextExcerpt(""), "");
});

test("le tiret bas vaut italique, mais seulement en bord de mot", () => {
  assert.ok(richTextToEmailHtml("_doux_").includes("<em>doux</em>"));
  assert.ok(richTextToEmailHtml("**_gras italique_**").includes("<em>gras italique</em>"));
  // Un nom de fichier ne doit pas devenir italique en son milieu.
  assert.equal(richTextToPlain("fichier_de_sauvegarde.pdf"), "fichier_de_sauvegarde.pdf");
  assert.ok(!richTextToEmailHtml("fichier_de_sauvegarde.pdf").includes("<em>"));
  assert.equal(richTextToPlain("un _ seul"), "un _ seul");
});

test("le rendu vers l'éditeur reprend les balises que le sérialiseur sait relire", () => {
  const html = richTextToEditorHtml("## Titre\n\nDu **gras** et un [lien](https://pleinr.fr)\n\n- un\n- deux\n\n1. a");
  assert.ok(html.includes("<h4>Titre</h4>"));
  assert.ok(html.includes("<strong>gras</strong>"));
  assert.ok(html.includes('<a href="https://pleinr.fr/">lien</a>'));
  assert.ok(html.includes("<ul><li>un</li><li>deux</li></ul>"));
  assert.ok(html.includes("<ol><li>a</li></ol>"));
});

test("un contenu vide offre une ligne où écrire", () => {
  assert.equal(richTextToEditorHtml(""), "<p><br></p>");
  assert.equal(richTextToEditorHtml("   "), "<p><br></p>");
});

test("le rendu vers l'éditeur échappe le texte et refuse les cibles hostiles", () => {
  const html = richTextToEditorHtml('<script>alert(1)</script> & "guillemets"');
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp;"));
  assert.ok(!html.includes("<script"));
  assert.ok(!richTextToEditorHtml("[x](javascript:alert(1))").includes("<a "));
});
