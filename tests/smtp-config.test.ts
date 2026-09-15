import test from "node:test";
import assert from "node:assert/strict";
import {
  IMPLICIT_TLS_PORT,
  STARTTLS_PORTS,
  describeSmtpError,
  impliedSecure,
  tlsMismatch,
} from "../src/lib/smtp-config";

test("smtp — seul le port 465 chiffre dès l'ouverture", () => {
  assert.equal(impliedSecure(IMPLICIT_TLS_PORT), true);
  for (const port of STARTTLS_PORTS) assert.equal(impliedSecure(port), false);
  assert.equal(impliedSecure(1025), false);
});

test("smtp — le couple port / chiffrement cohérent ne dit rien", () => {
  assert.equal(tlsMismatch(465, true), null);
  assert.equal(tlsMismatch(587, false), null);
  assert.equal(tlsMismatch(25, false), null);
});

test("smtp — case cochée sur un port STARTTLS : on prévient avec le port", () => {
  const warning = tlsMismatch(587, true);
  assert.ok(warning);
  assert.match(warning, /587/);
  assert.match(warning, /STARTTLS/);
});

test("smtp — case décochée sur le port 465 : on prévient aussi", () => {
  const warning = tlsMismatch(465, false);
  assert.ok(warning);
  assert.match(warning, /465/);
});

test("smtp — « wrong version number » désigne la case à décocher", () => {
  const message = describeSmtpError(
    "140342:error:0A00010B:SSL routines:ssl3_get_record:wrong version number",
    { host: "mail.infomaniak.com", port: 587, secure: true },
  );
  assert.match(message, /Décochez/);
  assert.match(message, /587/);
});

test("smtp — délai dépassé sur le 465 sans chiffrement : on désigne la case à cocher", () => {
  const message = describeSmtpError("Greeting never received", { host: "mail.infomaniak.com", port: 465, secure: false });
  assert.match(message, /Cochez/);
});

test("smtp — délai dépassé sur un port STARTTLS : on évoque le filtrage sortant", () => {
  const message = describeSmtpError("connect ETIMEDOUT 1.2.3.4:587", { host: "mail.infomaniak.com", port: 587, secure: false });
  assert.match(message, /filtré/);
  assert.doesNotMatch(message, /Cochez/);
});

test("smtp — authentification refusée : on oriente vers le mot de passe d'application", () => {
  const message = describeSmtpError("Invalid login: 535 5.7.8 Authentication failed", { host: "smtp.gmail.com", port: 587 });
  assert.match(message, /mot de passe d'application/);
});

test("smtp — nom de serveur introuvable : on cite le nom saisi", () => {
  const message = describeSmtpError("getaddrinfo ENOTFOUND mail.exemple.invalid", { host: "mail.exemple.invalid" });
  assert.match(message, /mail\.exemple\.invalid/);
});

test("smtp — l'explication précède toujours la trace technique", () => {
  const raw = "140342:error:0A00010B:SSL routines:ssl3_get_record:wrong version number";
  const message = describeSmtpError(raw, { host: "mail.infomaniak.com", port: 587, secure: true });
  assert.ok(message.indexOf("détail") > 0);
  assert.ok(!message.startsWith(raw));
});

test("smtp — un échec inconnu est rendu tel quel, jamais vide", () => {
  assert.equal(describeSmtpError("Panne inattendue"), "Panne inattendue");
  assert.equal(describeSmtpError(""), "Serveur SMTP injoignable");
});
