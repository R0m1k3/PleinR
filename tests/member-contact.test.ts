import { test } from "node:test";
import assert from "node:assert/strict";

import { contactName, memberContact, telHref } from "../src/lib/member-contact";

test("le référent joint prénom et nom", () => {
  assert.equal(contactName({ contactFirstName: "Marie", contactLastName: "Durand" }), "Marie Durand");
  assert.equal(contactName({ contactFirstName: "  Marie  ", contactLastName: " Durand " }), "Marie Durand");
  assert.equal(contactName({ contactFirstName: "Marie" }), "Marie");
  assert.equal(contactName({ contactLastName: "Durand" }), "Durand");
  assert.equal(contactName({}), null);
  assert.equal(contactName({ contactFirstName: "   ", contactLastName: null }), null);
});

test("un référent sans nom ni téléphone n'existe pas", () => {
  assert.equal(memberContact({}), null);
  assert.equal(memberContact({ contactFirstName: " ", contactPhone: "" }), null);
  assert.deepEqual(memberContact({ contactPhone: "03 83 24 10 10" }), {
    name: null,
    phone: "03 83 24 10 10",
  });
  assert.deepEqual(memberContact({ contactLastName: "Durand", contactPhone: null }), {
    name: "Durand",
    phone: null,
  });
});

test("le lien tel: ne garde que les chiffres et l'indicatif", () => {
  assert.equal(telHref("03 83 24 10 10"), "tel:0383241010");
  assert.equal(telHref("+33 3 83 24 10 10"), "tel:+33383241010");
  assert.equal(telHref("03.83.24.10.10"), "tel:0383241010");
  assert.equal(telHref("sur rendez-vous"), null);
  assert.equal(telHref(null), null);
  assert.equal(telHref("  "), null);
});
