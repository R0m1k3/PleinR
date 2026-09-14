import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { activityNodes, sanitizeActivityMessage } from "../src/lib/activity";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "../src/lib/login-throttle";
import { decryptSecret, encryptSecret, tryDecryptSecret } from "../src/lib/crypto";

process.env.SOCIAL_TOKEN_KEY ??= "cle-de-test-suffisamment-longue-pour-scrypt";

/** Rend les nœuds React en texte brut, pour vérifier ce qui atteint le DOM. */
function renderToText(message: string): string {
  const nodes = activityNodes(message);
  const flat = Array.isArray(nodes) ? nodes : [nodes];
  return JSON.stringify(flat);
}

describe("Journal d'activité — XSS stocké", () => {
  // Ces messages agrègent des saisies de tiers, dont le formulaire de contact
  // public : ils étaient rendus en HTML brut sur le tableau de bord admin.
  const payloads = [
    `<img src=x onerror="alert(1)">`,
    `<script>alert(1)</script>`,
    `<strong onclick="alert(1)">x</strong>`,
    `<svg/onload=alert(1)>`,
    `<iframe src="javascript:alert(1)">`,
    `<ScRiPt>alert(1)</ScRiPt>`,
    `<img src=x onerror=alert(1)`,
    `<a href="javascript:alert(1)">clic</a>`,
  ];

  for (const payload of payloads) {
    it(`neutralise ${payload.slice(0, 32)}`, () => {
      const stored = sanitizeActivityMessage(`<strong>Pirate</strong> « ${payload} »`);
      assert.ok(!/<script|<iframe|<svg|<img|<a\b|onerror|onload|onclick/i.test(stored),
        `balise survivante dans : ${stored}`);

      // Même si un message malveillant existait déjà en base, le rendu React
      // l'échappe : rien d'exécutable ne peut atteindre le DOM.
      const rendered = renderToText(payload);
      assert.ok(!rendered.includes('"dangerouslySetInnerHTML"'));
    });
  }

  it("conserve la mise en gras légitime", () => {
    const stored = sanitizeActivityMessage("<strong>Au Bon Pain</strong> a soumis une promotion");
    assert.equal(stored, "<strong>Au Bon Pain</strong> a soumis une promotion");
    assert.ok(renderToText(stored).includes("Au Bon Pain"));
  });

  it("garde le texte lisible quand une balise est retirée", () => {
    const stored = sanitizeActivityMessage("Promotion « <b>Soldes</b> » validée");
    assert.ok(stored.includes("Soldes"));
    assert.ok(stored.includes("validée"));
  });
});

describe("Limitation des tentatives de connexion", () => {
  it("laisse passer les premières tentatives puis bloque", () => {
    const key = `essai-${Date.now()}@test.fr`;
    assert.equal(isLoginBlocked(key), false);
    for (let i = 0; i < 7; i++) recordLoginFailure(key);
    assert.equal(isLoginBlocked(key), false, "blocage prématuré");
    recordLoginFailure(key);
    assert.equal(isLoginBlocked(key), true, "8e échec non bloqué");
  });

  it("remet le compteur à zéro après une connexion réussie", () => {
    const key = `succes-${Date.now()}@test.fr`;
    for (let i = 0; i < 10; i++) recordLoginFailure(key);
    assert.equal(isLoginBlocked(key), true);
    clearLoginFailures(key);
    assert.equal(isLoginBlocked(key), false);
  });

  it("isole les comptes entre eux", () => {
    const cible = `cible-${Date.now()}@test.fr`;
    const voisin = `voisin-${Date.now()}@test.fr`;
    for (let i = 0; i < 10; i++) recordLoginFailure(cible);
    assert.equal(isLoginBlocked(cible), true);
    assert.equal(isLoginBlocked(voisin), false);
  });
});

describe("Chiffrement des secrets réseaux", () => {
  const secret = "EAAB-jeton-de-page-très-long-avec-accents-éàç";

  it("fait un aller-retour fidèle", () => {
    assert.equal(decryptSecret(encryptSecret(secret)), secret);
  });

  it("ne laisse pas le clair dans le chiffré", () => {
    assert.ok(!encryptSecret(secret).includes(secret));
  });

  it("produit un résultat différent à chaque appel (IV aléatoire)", () => {
    assert.notEqual(encryptSecret(secret), encryptSecret(secret));
  });

  it("rejette un contenu altéré (authentification GCM)", () => {
    const parts = encryptSecret(secret).split(":");
    const payload = Buffer.from(parts[3], "base64");
    payload[0] ^= 0xff;
    parts[3] = payload.toString("base64");
    assert.throws(() => decryptSecret(parts.join(":")));
  });

  it("rejette un format inattendu", () => {
    assert.throws(() => decryptSecret("pas-un-secret-chiffré"));
    assert.equal(tryDecryptSecret("pas-un-secret-chiffré"), null);
  });
});

describe("Coordonnées du référent — jamais dans les lectures publiques", () => {
  const source = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");

  /** Corps d'une fonction exportée de `queries.ts`, jusqu'à la suivante. */
  function bodyOf(name: string): string {
    const start = source.indexOf(`export async function ${name}(`);
    assert.notEqual(start, -1, `${name} introuvable dans src/lib/queries.ts`);
    const next = source.indexOf("\nexport ", start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  }

  // Nom, prénom et ligne directe de l'adhérent ne sont montrés qu'à un visiteur
  // connecté. La garantie tient à une seule chose : aucune requête servant une
  // page publique ne les rapatrie — sinon ils partiraient dans le HTML, le
  // JSON-LD ou les props du composant client de l'annuaire.
  const publicReads = [
    "getActiveMembersWithCategory",
    "getActiveMembersByCategory",
    "getRotatingActiveMembers",
    "getPublicMember",
    "getLivePromotions",
  ];

  for (const name of publicReads) {
    it(`${name} ne lit pas le référent`, () => {
      const body = bodyOf(name);
      for (const column of ["contactFirstName", "contactLastName", "contactPhone"]) {
        assert.ok(
          !body.includes(column),
          `${name} sélectionne ${column} : ces coordonnées deviendraient publiques.`
        );
      }
    });
  }

  it("les lectures réservées existent et sont séparées", () => {
    for (const name of ["getMemberContacts", "getMemberContact"]) {
      const body = bodyOf(name);
      assert.ok(body.includes("contactPhone"), `${name} devrait lire le référent`);
    }
  });
});
