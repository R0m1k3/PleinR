import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { CATEGORY_PALETTE, CATEGORY_REFERENTIAL, categoryRows } from "../src/db/categories";

describe("Référentiel des catégories", () => {
  it("garde des slugs uniques et stables", () => {
    const slugs = CATEGORY_REFERENTIAL.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length, "slug en double");
    for (const slug of slugs) {
      assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `slug invalide : ${slug}`);
    }
    // Slugs historiques : des fiches adhérents y sont rattachées.
    for (const legacy of ["alimentation", "boulangerie", "restauration", "mode-beaute", "artisanat", "services", "sante"]) {
      assert.ok(slugs.includes(legacy), `${legacy} doit rester présent`);
    }
  });

  it("couvre les métiers demandés (assurance, bazar/discount, grande distribution…)", () => {
    const slugs = new Set(CATEGORY_REFERENTIAL.map((c) => c.slug));
    for (const expected of ["assurance", "bazar-discount", "supermarche", "librairie-papeterie", "tabac-presse", "veterinaire", "auto-ecole"]) {
      assert.ok(slugs.has(expected), `${expected} manquant`);
    }
  });

  it("respecte les contraintes de la table", () => {
    for (const row of categoryRows()) {
      assert.ok(row.label.length <= 120, `libellé trop long : ${row.label}`);
      assert.ok(row.slug.length <= 80);
      assert.ok(CATEGORY_PALETTE.some((p) => p.accent === row.accent && p.tint === row.tint));
      assert.ok(row.sort >= 1);
    }
  });

  it("est intégralement repris par la migration 0012", () => {
    const sql = readFileSync(new URL("../drizzle/0012_referentiel_categories.sql", import.meta.url), "utf8");
    for (const row of categoryRows()) {
      assert.ok(sql.includes(`('${row.slug}', '${row.label.replace(/'/g, "''")}', '${row.accent}', '${row.tint}', ${row.sort})`),
        `${row.slug} absent ou différent dans la migration`);
    }
    // Ne jamais écraser un libellé renommé depuis le backend.
    assert.ok(sql.includes('ON CONFLICT ("slug") DO UPDATE SET "sort" = EXCLUDED."sort";'));
    assert.ok(!/DO UPDATE SET[^;]*"label"/.test(sql));
  });
});
