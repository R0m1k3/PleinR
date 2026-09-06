import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { CATEGORY_REFERENTIAL } from "../src/db/categories";
import { PROMO_CATEGORIES, PROMO_CATEGORY_GROUPS, defaultPromoCategory } from "../src/lib/promo-categories";

describe("Catégories de promotion (types de produits)", () => {
  it("propose une liste large, sans doublon, groupée", () => {
    assert.ok(PROMO_CATEGORIES.length >= 70, `liste trop courte : ${PROMO_CATEGORIES.length}`);
    assert.equal(new Set(PROMO_CATEGORIES).size, PROMO_CATEGORIES.length, "doublon");
    assert.ok(PROMO_CATEGORY_GROUPS.every((g) => g.items.length > 0 && g.label));
    assert.ok(PROMO_CATEGORIES.includes("Autre"));
    for (const c of PROMO_CATEGORIES) assert.ok(c.length <= 120, `trop long pour la colonne : ${c}`);
  });

  it("pré-sélectionne un type cohérent pour chaque métier du référentiel", () => {
    for (const c of CATEGORY_REFERENTIAL) {
      const d = defaultPromoCategory(c.slug);
      assert.ok(PROMO_CATEGORIES.includes(d), `${c.slug} → ${d} inconnu`);
    }
    assert.equal(defaultPromoCategory("boulangerie"), "Pain & viennoiseries");
    assert.equal(defaultPromoCategory("bazar-discount"), "Bazar & petit équipement");
    assert.equal(defaultPromoCategory("inconnu"), "Autre");
    assert.equal(defaultPromoCategory(null), "Autre");
  });
});
