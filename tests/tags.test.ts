import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { CATEGORY_REFERENTIAL } from "../src/db/categories";
import { CATEGORY_TAGS, MAX_TAGS, autoTags, formatTags, parseTags, suggestTags, tagsFromDescription } from "../src/lib/tags";

describe("Tags automatiques", () => {
  it("couvre chaque métier du référentiel", () => {
    for (const c of CATEGORY_REFERENTIAL) {
      assert.ok((CATEGORY_TAGS[c.slug] ?? []).length >= 3, `vocabulaire manquant ou trop court : ${c.slug}`);
    }
  });

  it("nettoie et dédoublonne la saisie", () => {
    assert.deepEqual(parseTags(" Pain ,pain, PAIN ;Levain,,  Fait  maison "), ["Pain", "Levain", "Fait maison"]);
    assert.deepEqual(parseTags("Épicerie, epicerie"), ["Épicerie"]);
    assert.equal(formatTags(["a", "b", "a"]), "a, b");
  });

  it("lit la description sans accents ni casse", () => {
    const tags = tagsFromDescription("Pains au LEVAIN faits maison, produits LOCAUX, livraison le dimanche. Devis gratuit.");
    for (const expected of ["Fait maison", "Produits locaux", "Livraison", "Ouvert le dimanche", "Devis gratuit"]) {
      assert.ok(tags.includes(expected), `${expected} attendu dans ${tags.join(", ")}`);
    }
    assert.deepEqual(tagsFromDescription(""), []);
  });

  it("suggère métier, commune puis description, dans la limite", () => {
    const tags = suggestTags({
      categorySlug: "boulangerie",
      city: "Frouard",
      description: "Boulangerie artisanale : pain au levain et viennoiseries faites maison.",
    });
    assert.equal(tags[0], "Boulangerie");
    assert.ok(tags.includes("Frouard"));
    assert.ok(tags.includes("Fait maison"));
    assert.ok(tags.includes("Artisanal"));
    assert.ok(tags.length <= MAX_TAGS);
    // Les mots du métier cités dans la description passent devant les autres.
    assert.ok(tags.indexOf("Pain") < tags.indexOf("Sandwichs"));
  });

  it("dérive du libellé quand le slug est inconnu (catégorie créée dans le backend)", () => {
    assert.deepEqual(suggestTags({ categorySlug: "ma-categorie", categoryLabel: "Toilettage – Pension canine" }), [
      "Toilettage",
      "Pension canine",
    ]);
  });

  it("ne remplace jamais une saisie existante", () => {
    assert.equal(autoTags("Kouglof, Brioche", { categorySlug: "boulangerie", city: "Frouard" }), "Kouglof, Brioche");
    assert.equal(autoTags("  ", { categorySlug: "assurance", city: "Pompey" }), "Assurance, Assurance auto, Assurance habitation, Mutuelle santé, Prévoyance, Assurance professionnelle, Pompey");
    assert.equal(autoTags("", {}), null);
  });
});
