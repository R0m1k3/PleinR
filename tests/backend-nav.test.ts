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
