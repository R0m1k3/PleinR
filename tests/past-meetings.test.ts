import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Invariants de l'écran « Rencontres passées ». Ils portent sur du code que les
 * tests unitaires ne peuvent pas exécuter (composants client, actions serveur),
 * d'où la lecture des sources — même approche que `tests/security.test.ts`.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const actions = read("../src/app/backend/actions.ts");
const dialog = read("../src/app/backend/rencontres-passees/PastMeetingDialog.tsx");
const page = read("../src/app/backend/rencontres-passees/page.tsx");
const imageField = read("../src/components/ImageField.tsx");
const modal = read("../src/components/ModalShell.tsx");

test("aucune image n'est refusée pour son poids : elle est compressée", () => {
  const code = imageField.replace(/\/\/[^\n]*/g, "");
  assert.ok(!/\.size\s*>/.test(code), "ImageField refuse encore un fichier sur son poids");
  assert.ok(!/trop lourde/i.test(code), "ImageField renvoie encore « image trop lourde »");
  assert.ok(imageField.includes("prepareImageFile"), "ImageField ne compresse pas");
  assert.ok(dialog.includes("prepareImageFile"), "la fenêtre des rencontres ne compresse pas");
});

test("les photos n'entrent en base qu'en data-URI", () => {
  const body = actions.slice(actions.indexOf("export async function addPastMeetingPhotos"));
  const scope = body.slice(0, body.indexOf("export async function savePastMeetingPhotos"));
  assert.ok(scope.includes("IMAGE_DATA_URI.test"), "une photo pourrait entrer sous forme d'URL (SSRF)");
  assert.ok(scope.includes("MAX_IMAGE_DATA_URI"), "aucune limite de taille côté serveur");
});

test("la synchronisation des photos ne peut pas vider une galerie par accident", () => {
  const body = actions.slice(actions.indexOf("export async function savePastMeetingPhotos"));
  assert.ok(body.includes('formData.get("syncPhotos") !== "1"'), "le drapeau de garde a disparu");
});

test("les refus d'enregistrement sont renvoyés, jamais levés", () => {
  const body = actions.slice(
    actions.indexOf("export async function savePastMeeting("),
    actions.indexOf("export async function deletePastMeeting("),
  );
  assert.ok(body.includes('return { error: "Donnez un titre'), "un titre vide ne rend plus d'erreur affichable");
  // Le seul `throw` admis est la violation d'accès, qui n'a pas à s'expliquer.
  const throws = [...body.matchAll(/throw new Error\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.deepEqual(throws, ["Accès refusé"], `throw inattendu : ${throws.join(", ")}`);
});

test("la rencontre liée est vérifiée avant l'écriture", () => {
  const body = actions.slice(actions.indexOf("export async function savePastMeeting("));
  assert.ok(body.includes("n'existe plus"), "une rencontre supprimée casserait l'enregistrement sans explication");
});

test("la fenêtre ne se referme qu'une fois la page rafraîchie", () => {
  // Sans cette attente, rouvrir la fiche montrerait l'état d'avant
  // l'enregistrement : c'est ce qui fait croire qu'une rencontre liée « ne
  // veut pas » être retenue.
  assert.ok(dialog.includes("closing && !refreshing"), "la fermeture ne suit plus le rafraîchissement");
});

test("la fenêtre est rendue dans un portail", () => {
  // Une carte survolée porte un `transform` : un `position: fixed` rendu à
  // l'intérieur s'ouvrirait dans la carte, pas sur la page.
  assert.ok(modal.includes("createPortal"), "la fenêtre n'est plus portée vers <body>");
});

test("le récit s'écrit dans un grand champ, et la page ne le ré-affiche pas en entier", () => {
  assert.ok(/rows=\{1[0-9]\}/.test(dialog), "le champ de récit est redevenu minuscule");
  assert.ok(dialog.includes("minHeight: 260"), "la hauteur minimale du récit a disparu");
  assert.ok(page.includes("pm-card__text"), "la carte n'écrête plus le texte");
});
