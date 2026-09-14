import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMimeMessage,
  bytesToBase64,
  encodeHeaderValue,
  formatAddress,
  toBase64Url,
  utf8ToBase64,
  wrapBase64,
} from "../src/lib/mime";

const BOUNDARIES = ["ALT", "REL"];

test("un objet purement ASCII part tel quel", () => {
  assert.equal(encodeHeaderValue("Invitation Plein R"), "Invitation Plein R");
});

test("un objet accentué est encodé en mot RFC 2047", () => {
  const encoded = encodeHeaderValue("Rencontre à Pompey");
  assert.match(encoded, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  assert.equal(Buffer.from(encoded.slice(10, -2), "base64").toString("utf8"), "Rencontre à Pompey");
});

test("un objet accentué long est replié en plusieurs mots d'au plus 75 caractères", () => {
  const encoded = encodeHeaderValue(
    "Assemblée générale de l'association Plein R du Bassin de Pompey — mardi 14 octobre à 19 h, salle Jean-Jaurès",
  );
  const words = encoded.split("\r\n ");
  assert.ok(words.length > 1, "le texte long doit être replié");
  for (const word of words) {
    assert.ok(word.length <= 75, `mot trop long : ${word.length}`);
    assert.match(word, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  }
  const decoded = words.map((w) => Buffer.from(w.slice(10, -2), "base64").toString("utf8")).join("");
  assert.equal(decoded, "Assemblée générale de l'association Plein R du Bassin de Pompey — mardi 14 octobre à 19 h, salle Jean-Jaurès");
});

test("le repli ne coupe jamais une séquence UTF-8 en deux", () => {
  // Que des caractères à 3 octets : 45 / 3 = 15 par mot, sans reste.
  const encoded = encodeHeaderValue("€".repeat(40));
  const decoded = encoded
    .split("\r\n ")
    .map((w) => Buffer.from(w.slice(10, -2), "base64").toString("utf8"))
    .join("");
  assert.equal(decoded, "€".repeat(40));
});

test("un retour à la ligne dans un en-tête ne permet pas d'en injecter un autre", () => {
  const encoded = encodeHeaderValue("Bonjour\r\nBcc: espion@example.com");
  assert.ok(!encoded.includes("\r"));
  assert.ok(!encoded.includes("\n"));
  assert.equal(encoded, "Bonjour Bcc: espion@example.com");
});

test("une adresse avec nom affiché est mise en forme, une adresse nue reste nue", () => {
  assert.equal(formatAddress("contact@pleinr.fr"), "contact@pleinr.fr");
  assert.equal(formatAddress("contact@pleinr.fr", "Plein R"), '"Plein R" <contact@pleinr.fr>');
  assert.equal(
    formatAddress("contact@pleinr.fr", 'Plein "R"'),
    '"Plein \\"R\\"" <contact@pleinr.fr>',
  );
});

test("un nom affiché accentué est encodé, pas mis entre guillemets", () => {
  const address = formatAddress("contact@pleinr.fr", "Association Plein R — Élan");
  assert.match(address, /^=\?UTF-8\?B\?.+\?= <contact@pleinr\.fr>$/);
});

test("une adresse malformée ne peut pas glisser d'en-tête supplémentaire", () => {
  assert.equal(
    formatAddress("victime@pleinr.fr>\r\nBcc: espion@example.com", "Plein R"),
    '"Plein R" <victime@pleinr.frBcc: espion@example.com>',
  );
});

test("le base64 est replié à 76 colonnes", () => {
  const lines = wrapBase64(utf8ToBase64("x".repeat(400))).split("\r\n");
  for (const line of lines) assert.ok(line.length <= 76, `ligne de ${line.length} caractères`);
  assert.ok(lines.length > 1);
});

test("toBase64Url retire le remplissage et remplace + et /", () => {
  const raw = bytesToBase64(Uint8Array.from([251, 255, 190, 0]));
  assert.ok(raw.includes("+") || raw.includes("/"));
  const url = toBase64Url(raw);
  assert.ok(!url.includes("+") && !url.includes("/") && !url.includes("="));
  assert.equal(url, raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
});

test("un message HTML seul tient en une seule partie", () => {
  const mime = buildMimeMessage({ subject: "Bonjour", html: "<p>Salut</p>" });
  assert.match(mime, /^Subject: Bonjour\r\nMIME-Version: 1\.0\r\nContent-Type: text\/html; charset=UTF-8\r\n/);
  assert.ok(!mime.includes("multipart"));
  assert.ok(mime.includes(utf8ToBase64("<p>Salut</p>")));
});

test("html + texte donnent un multipart/alternative, le texte d'abord", () => {
  const mime = buildMimeMessage({
    subject: "Bonjour",
    html: "<p>Salut</p>",
    text: "Salut",
    boundaries: BOUNDARIES,
  });
  assert.ok(mime.includes('Content-Type: multipart/alternative; boundary="ALT"'));
  assert.ok(mime.includes("--ALT--"));
  assert.ok(
    mime.indexOf("text/plain") < mime.indexOf("text/html"),
    "le repli texte doit précéder la version préférée",
  );
});

test("une image en ligne enveloppe le tout dans un multipart/related", () => {
  const mime = buildMimeMessage({
    subject: "Bonjour",
    html: '<img src="cid:logo">',
    text: "Bonjour",
    boundaries: BOUNDARIES,
    inline: [{ filename: "logo.png", contentType: "image/png", contentId: "logo", base64: "AAAA" }],
  });
  assert.ok(mime.includes('Content-Type: multipart/related; type="text/html"; boundary="REL"'));
  assert.ok(mime.includes("Content-ID: <logo>"));
  assert.ok(mime.includes('Content-Disposition: inline; filename="logo.png"'));
  // L'alternative reste imbriquée dans le related, pas l'inverse.
  assert.ok(mime.indexOf("--REL") < mime.indexOf("multipart/alternative"));
  assert.ok(mime.includes("--ALT--"));
  assert.ok(mime.includes("--REL--"));
});

test("une pièce jointe sans identifiant de contenu est attachée, pas incorporée", () => {
  const mime = buildMimeMessage({
    subject: "Compte rendu",
    html: "<p>Ci-joint</p>",
    boundaries: BOUNDARIES,
    inline: [{ filename: "cr.pdf", contentType: "application/pdf", base64: "AAAA" }],
  });
  assert.ok(mime.includes('Content-Disposition: attachment; filename="cr.pdf"'));
  assert.ok(!mime.includes("Content-ID"));
});

test("le message n'utilise que des CRLF, jamais un LF isolé", () => {
  const mime = buildMimeMessage({
    subject: "Rencontre à Pompey — programme complet de la soirée du 14 octobre",
    html: "<p>Ligne une</p>\n<p>Ligne deux</p>",
    text: "Ligne une\nLigne deux",
    boundaries: BOUNDARIES,
    inline: [{ filename: "logo.png", contentType: "image/png", contentId: "logo", base64: "AAAA" }],
  });
  // Les corps sont encodés en base64 : aucun LF de la source ne survit brut.
  assert.equal(mime.replace(/\r\n/g, ""), mime.replace(/\r\n/g, "").replace(/[\r\n]/g, ""));
  assert.ok(!/(?<!\r)\n/.test(mime), "un LF sans CR précède");
});

test("une frontière ne peut pas apparaître dans la charge utile", () => {
  const mime = buildMimeMessage({
    subject: "Essai",
    html: "<p>--ALT et --REL dans le texte</p>",
    text: "--ALT--",
    boundaries: BOUNDARIES,
  });
  // Les corps étant en base64, les seules occurrences sont les délimiteurs.
  assert.equal(mime.match(/--ALT/g)?.length, 3); // ouverture ×2 + fermeture
});

test("les en-têtes libres, l'expéditeur et le répondre-à sont posés", () => {
  const mime = buildMimeMessage({
    subject: "Essai",
    html: "<p>a</p>",
    from: '"Plein R" <contact@pleinr.fr>',
    to: "adherent@example.com",
    replyTo: "bureau@pleinr.fr",
    headers: { "X-Unsent": "1" },
  });
  assert.ok(mime.startsWith("X-Unsent: 1\r\n"));
  assert.ok(mime.includes('From: "Plein R" <contact@pleinr.fr>\r\n'));
  assert.ok(mime.includes("To: adherent@example.com\r\n"));
  assert.ok(mime.includes("Reply-To: bureau@pleinr.fr\r\n"));
});
