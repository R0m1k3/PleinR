import { test } from "node:test";
import assert from "node:assert/strict";

import { dedupeRecipients, isPlausibleEmail } from "../src/lib/mail-recipients";

test("une adresse manifestement cassée est écartée", () => {
  assert.equal(isPlausibleEmail("contact@pleinr.fr"), true);
  assert.equal(isPlausibleEmail("  contact@pleinr.fr  "), true);
  assert.equal(isPlausibleEmail(""), false);
  assert.equal(isPlausibleEmail("pas-une-adresse"), false);
  assert.equal(isPlausibleEmail("contact@pleinr"), false);
  assert.equal(isPlausibleEmail("a@b.fr, c@d.fr"), false);
  assert.equal(isPlausibleEmail("victime@pleinr.fr>\r\nBcc: espion@x.fr"), false);
});

test("N destinataires donnent N entrées, jamais une seule fusionnée", () => {
  const rows = [
    { email: "a@pleinr.fr", name: "A", memberId: 1 },
    { email: "b@pleinr.fr", name: "B", memberId: 2 },
    { email: "c@pleinr.fr", name: "C", memberId: 3 },
  ];
  const out = dedupeRecipients(rows);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((r) => r.email), ["a@pleinr.fr", "b@pleinr.fr", "c@pleinr.fr"]);
});

test("un doublon ne reçoit pas deux fois, quelle que soit la casse", () => {
  const out = dedupeRecipients([
    { email: "Contact@PleinR.fr", name: "Premier", memberId: 1 },
    { email: "contact@pleinr.fr", name: "Second", memberId: 2 },
    { email: "  CONTACT@pleinr.FR ", name: "Troisième", memberId: 3 },
  ]);
  assert.equal(out.length, 1);
  // La première occurrence gagne, avec son nom et son rattachement.
  assert.equal(out[0].name, "Premier");
  assert.equal(out[0].memberId, 1);
  assert.equal(out[0].email, "Contact@PleinR.fr");
});

test("les lignes sans adresse utilisable disparaissent", () => {
  const out = dedupeRecipients([
    { email: null, name: "Sans adresse", memberId: 1 },
    { email: "   ", name: "Vide", memberId: 2 },
    { email: "cassée", name: "Invalide", memberId: 3 },
    { email: "bon@pleinr.fr", name: "Bon", memberId: 4 },
  ]);
  assert.deepEqual(out, [{ email: "bon@pleinr.fr", name: "Bon", memberId: 4 }]);
});

test("un nom absent devient une chaîne vide, pas « null »", () => {
  const out = dedupeRecipients([{ email: "bon@pleinr.fr", name: null, memberId: null }]);
  assert.deepEqual(out, [{ email: "bon@pleinr.fr", name: "", memberId: null }]);
});
