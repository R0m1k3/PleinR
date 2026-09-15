import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * La barre latérale d'administration tient dans deux structures littérales de
 * `BackendShell.tsx` — les titres d'en-tête et les sections — plus le jeu
 * d'icônes. Ajouter un écran demande de toucher aux trois : ce test attrape
 * l'oubli, qui se voit sinon par une icône absente ou un en-tête vide.
 */

const shell = readFileSync(new URL("../src/app/backend/BackendShell.tsx", import.meta.url), "utf8");
const icons = readFileSync(new URL("../src/components/BackendIcons.tsx", import.meta.url), "utf8");

/** Entrées de navigation déclarées dans `SECTIONS`. */
const navItems = [...shell.matchAll(/\{\s*href:\s*"([^"]+)",\s*label:\s*"([^"]*)",\s*icon:\s*"([^"]+)"/g)].map(
  (match) => ({ href: match[1], label: match[2], icon: match[3] })
);

/** Clés du dictionnaire `TITLES`. */
const titled = new Set([...shell.matchAll(/^\s*"(\/backend[^"]*)":\s*\[/gm)].map((match) => match[1]));

/** Noms d'icônes réellement dessinés. */
const drawn = new Set([...icons.matchAll(/^\s{2}([a-z]+):\s*(?:\(|<)/gm)].map((match) => match[1]));

test("la navigation n'est pas vide", () => {
  assert.ok(navItems.length >= 10, `seulement ${navItems.length} entrées trouvées`);
  assert.ok(drawn.size >= 10, `seulement ${drawn.size} icônes trouvées`);
});

for (const item of navItems) {
  test(`« ${item.label} » a son icône et son en-tête`, () => {
    assert.ok(drawn.has(item.icon), `l'icône « ${item.icon} » n'est dessinée nulle part`);
    assert.ok(titled.has(item.href), `${item.href} n'a pas d'entrée dans TITLES`);
  });
}

test("chaque icône déclarée dans le type est dessinée", () => {
  const declared = [...icons.matchAll(/^\s*\|\s*"([a-z]+)"/gm)].map((match) => match[1]);
  assert.ok(declared.length > 0, "aucune icône déclarée : le test ne vérifie plus rien");
  for (const name of declared) {
    assert.ok(drawn.has(name), `l'icône « ${name} » est déclarée mais pas dessinée`);
  }
});

/**
 * Un adhérent n'a pas de barre latérale : elle ne porterait que la section
 * « Côté adhérent », déjà rendue en onglets par `EspaceHeader`. Le test tient
 * les deux bouts — la coquille doit brancher sur le rôle, et sa variante sans
 * barre ne doit rendre ni `aside`, ni bouton de tiroir.
 */
const memberStart = shell.indexOf("if (!isStaff(user.role))");
// La tranche s'arrête à la coquille du staff, sinon elle l'embarquerait et
// le test verrait son <aside> — il passerait pour un échec de la variante.
const staffStart = shell.indexOf('<div className="backend" style', memberStart);
const memberBranch = shell.slice(memberStart, staffStart);

test("la coquille distingue le staff de l'adhérent", () => {
  assert.ok(shell.includes("isStaff"), "BackendShell ne consulte plus le rôle");
  assert.ok(memberStart >= 0, "la branche sans barre latérale a disparu");
  assert.ok(staffStart > memberStart, "la coquille du staff ne suit plus la branche adhérent");
});

test("la variante adhérent ne rend ni barre latérale ni tiroir", () => {
  assert.ok(!/<aside/.test(memberBranch), "un <aside> subsiste dans la variante adhérent");
  assert.ok(!memberBranch.includes("backend-burger"), "le bouton de tiroir subsiste sans tiroir à ouvrir");
  assert.ok(!memberBranch.includes("sidebar"), "une classe de barre latérale subsiste");
});

test("sans tiroir, les actions du compte restent dans l'entête", () => {
  // Sur téléphone elles vivaient dans la barre : sans elle, se déconnecter
  // deviendrait impossible si la règle d'affichage n'était pas rétablie.
  assert.ok(memberBranch.includes("{signOut}"), "la déconnexion a disparu de l'entête adhérent");
  assert.ok(memberBranch.includes("{siteLink}"), "le retour au site a disparu de l'entête adhérent");

  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.backend-header--plain\s+\.backend-header__actions\s*\{\s*display:\s*flex/,
    "les actions restent masquées sous 1024px, où le tiroir n'existe plus",
  );
});
