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

describe("Mots de passe temporaires — jamais mis en file d'attente", () => {
  const source = readFileSync(new URL("../src/app/backend/actions.ts", import.meta.url), "utf8");

  /** Corps d'une fonction exportée, jusqu'à la suivante. */
  function actionBody(name: string): string {
    const start = source.indexOf(`export async function ${name}(`);
    assert.notEqual(start, -1, `${name} introuvable dans src/app/backend/actions.ts`);
    const next = source.indexOf("\nexport ", start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  }

  // `mail_messages.html` est stocké en base. Mettre un message d'identifiants
  // dans la file y écrirait le mot de passe en clair, alors que tout le reste
  // du produit s'emploie à ne jamais le conserver : il part donc en ligne
  // directe, et seule une trace sans contenu est journalisée.
  const issuers = [
    "addMember",
    "createMissingMemberAccounts",
    "resetMemberPassword",
    "inviteAdmin",
    "approveMembershipRequest",
  ];

  for (const name of issuers) {
    it(`${name} envoie directement, sans passer par la file`, () => {
      const body = actionBody(name);
      assert.ok(body.includes("generateTempPassword()"), `${name} devrait émettre un mot de passe`);
      assert.ok(body.includes("deliverCredentials("), `${name} devrait transmettre les identifiants`);
      assert.ok(
        !body.includes("queueMail"),
        `${name} met un mot de passe temporaire dans la file : il finirait stocké en base.`
      );
    });
  }

  it("la trace journalisée ne porte aucun contenu", () => {
    const outbox = readFileSync(new URL("../src/lib/mail-outbox.ts", import.meta.url), "utf8");
    const start = outbox.indexOf("export async function logSentMail(");
    assert.notEqual(start, -1, "logSentMail introuvable");
    const body = outbox.slice(start, outbox.indexOf("\n/**", start + 1));
    assert.ok(body.includes('html: ""'), "logSentMail devrait écrire un corps vide");
  });
});

describe("Messagerie — aucun secret vers le navigateur", () => {
  const page = readFileSync(new URL("../src/app/backend/boite-mail/page.tsx", import.meta.url), "utf8");

  // Même règle que l'écran Réseaux sociaux : la page ne connaît que la
  // *présence* d'un secret, jamais sa valeur.
  for (const column of ["appSecret", "smtpPassword", "accessToken", "refreshToken"]) {
    it(`l'écran ne lit jamais ${column} en clair`, () => {
      // La présence du champ sert au libellé du champ de saisie ; ce qui est
      // interdit, c'est de le déchiffrer.
      assert.ok(
        !page.includes(`decryptSecret(`) && !page.includes(`tryDecryptSecret(`),
        `boite-mail/page.tsx déchiffre un secret : il partirait dans le HTML.`
      );
    });
  }

  it("le champ de saisie est masqué et un champ vide conserve la valeur", () => {
    assert.ok(page.includes('type="password"'), "les secrets doivent être saisis en champ masqué");
    assert.ok(
      page.includes("laissez vide pour le conserver"),
      "l'écran doit annoncer qu'un champ vide conserve le secret enregistré"
    );
  });

  it("les secrets sont chiffrés à l'écriture", () => {
    const accounts = readFileSync(new URL("../src/lib/mail-accounts.ts", import.meta.url), "utf8");

    /** Corps d'une fonction exportée, jusqu'à la suivante. */
    function writerBody(name: string): string {
      const start = accounts.indexOf(`export async function ${name}(`);
      assert.notEqual(start, -1, `${name} introuvable dans src/lib/mail-accounts.ts`);
      const next = accounts.indexOf("\nexport ", start + 1);
      return accounts.slice(start, next === -1 ? accounts.length : next);
    }

    // Seuls ces trois écrivent en base ; `exchangeMailCode` rend les jetons en
    // mémoire à son appelant, qui les chiffre.
    for (const name of ["saveOAuthApp", "saveSmtpAccount", "saveMailConnection"]) {
      const body = writerBody(name);
      const assignments = body.match(/\b(appSecret|smtpPassword|accessToken|refreshToken):\s*[^,\n]+/g) ?? [];
      // On écarte les annotations de type de la signature et les valeurs
      // littérales : seules les affectations réelles nous intéressent.
      const writes = assignments.filter(
        (assignment) => !/:\s*(null|""|string|number|boolean|Date)\b/.test(assignment)
      );
      assert.ok(writes.length > 0, `${name} n'écrit aucun secret : le test ne vérifie plus rien`);
      for (const assignment of writes) {
        assert.ok(
          assignment.includes("encryptSecret("),
          `${name} écrit un secret sans le chiffrer : ${assignment}`
        );
      }
    }
  });
});

describe("Diffusion groupée — aucune adresse partagée", () => {
  it("ni copie ni copie cachée nulle part dans la chaîne d'envoi", () => {
    for (const file of ["../src/lib/mailer.ts", "../src/lib/mail-outbox.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.ok(!/\bcc\s*:/i.test(source), `${file} pose une copie`);
      assert.ok(!/\bbcc\s*:/i.test(source), `${file} pose une copie cachée`);
    }
  });

  it("la file ne porte qu'un destinataire par ligne", () => {
    const schema = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
    assert.ok(
      /toAddress: varchar\("to_address", \{ length: \d+ \}\)\.notNull\(\)/.test(schema),
      "to_address devrait être une adresse unique et obligatoire"
    );
  });
});

describe("Informations — rien n'est rendu en HTML brut", () => {
  const files = [
    "../src/lib/rich-text.ts",
    "../src/components/InformationCard.tsx",
    "../src/app/backend/informations/InformationForm.tsx",
    "../src/app/backend/espace/informations/page.tsx",
  ];

  for (const file of files) {
    it(`${file.split("/").pop()} n'emprunte pas dangerouslySetInnerHTML`, () => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      // L'usage réel, pas la mention : `rich-text.ts` explique en commentaire
      // pourquoi il ne s'en sert pas.
      assert.ok(
        !/dangerouslySetInnerHTML\s*[={]/.test(source),
        "le texte des informations vient de tiers : il doit rester des nœuds React"
      );
    });
  }

  it("les lectures publiques ignorent les informations", () => {
    // Le fil est réservé aux adhérents connectés : aucune requête servant une
    // page publique ne doit y toucher.
    const queries = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");
    assert.ok(!queries.includes("informations"), "src/lib/queries.ts lit les informations");
  });
});

describe("Boucles de fond — jamais dans le bundle edge", () => {
  it("le module Node reste chargé à la demande et écarté du runtime edge", () => {
    const entry = readFileSync(new URL("../src/instrumentation.ts", import.meta.url), "utf8");
    assert.ok(entry.includes('NEXT_RUNTIME !== "nodejs"'), "la garde de runtime a disparu");
    assert.ok(!entry.includes("mail-outbox"), "instrumentation.ts importe la file directement");
    assert.ok(!entry.includes("nodemailer"), "instrumentation.ts importe nodemailer");

    const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    assert.ok(config.includes("IgnorePlugin"), "l'exclusion du bundle edge a disparu");
    assert.ok(config.includes('serverExternalPackages: ["nodemailer"]'), "nodemailer doit rester externe");
  });

  it("chaque boucle a son propre interrupteur", () => {
    // Couper le libérateur de promotions ne doit pas couper l'envoi des
    // e-mails : les deux n'ont rien à voir.
    const worker = readFileSync(new URL("../src/instrumentation-node.ts", import.meta.url), "utf8");
    assert.ok(worker.includes('process.env.PROMO_SCHEDULER !== "off"'));
    assert.ok(worker.includes('process.env.MAIL_WORKER !== "off"'));
  });
});
