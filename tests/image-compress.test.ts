import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BATCH_MAX_BYTES,
  MAX_SIDE,
  MIN_QUALITY,
  base64Bytes,
  chunkByBytes,
  compressionSteps,
  compressionSummary,
  isImageDataUri,
  needsCompression,
  scaleToFit,
} from "../src/lib/image-compress";

describe("Mise à l'échelle", () => {
  it("ramène le côté le plus long sous la limite en gardant le rapport", () => {
    assert.deepEqual(scaleToFit(4032, 3024, 2048), { width: 2048, height: 1536 });
    assert.deepEqual(scaleToFit(3024, 4032, 2048), { width: 1536, height: 2048 });
  });

  it("n'agrandit jamais une image plus petite que la limite", () => {
    assert.deepEqual(scaleToFit(800, 600, 2048), { width: 800, height: 600 });
  });

  it("ne rend rien pour des dimensions absurdes", () => {
    assert.deepEqual(scaleToFit(0, 600, 2048), { width: 0, height: 0 });
    assert.deepEqual(scaleToFit(Number.NaN, 600, 2048), { width: 0, height: 0 });
  });
});

describe("Paliers de compression", () => {
  const steps = compressionSteps(MAX_SIDE);

  it("commence à la définition pleine et à la meilleure qualité", () => {
    assert.equal(steps[0].maxSide, MAX_SIDE);
    assert.ok(steps[0].quality >= 0.9);
  });

  it("épuise la qualité avant de réduire la définition", () => {
    const firstDrop = steps.findIndex((step) => step.maxSide < MAX_SIDE);
    assert.ok(firstDrop > 1, "la définition ne doit pas tomber au deuxième essai");
    for (let index = 1; index < firstDrop; index += 1) {
      assert.ok(steps[index].quality < steps[index - 1].quality);
    }
  });

  it("ne remonte jamais en définition et reste au-dessus du plancher de qualité", () => {
    for (let index = 1; index < steps.length; index += 1) {
      assert.ok(steps[index].maxSide <= steps[index - 1].maxSide);
    }
    for (const step of steps) {
      assert.ok(step.quality >= MIN_QUALITY && step.quality <= 1);
      assert.ok(step.maxSide >= 320);
    }
  });
});

describe("Poids d'une data-URI", () => {
  it("retrouve le poids décodé sans décoder", () => {
    const bytes = Buffer.from("x".repeat(1000));
    const dataUri = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    assert.equal(base64Bytes(dataUri), 1000);
  });

  it("tient compte du remplissage", () => {
    for (const length of [1, 2, 3, 4, 5]) {
      const raw = Buffer.alloc(length, 7);
      assert.equal(base64Bytes(`data:image/png;base64,${raw.toString("base64")}`), length);
    }
  });

  it("rend zéro hors data-URI", () => {
    assert.equal(base64Bytes("https://exemple.fr/photo.jpg"), 0);
    assert.equal(base64Bytes(""), 0);
  });

  it("ne reconnaît qu'une image en data-URI", () => {
    assert.ok(isImageDataUri("data:image/jpeg;base64,AAAA"));
    assert.ok(!isImageDataUri("https://exemple.fr/photo.jpg"));
    assert.ok(!isImageDataUri("data:text/html;base64,AAAA"));
  });
});

describe("Décision de recompression", () => {
  it("garde le fichier d'origine quand il tient dans le budget et la définition", () => {
    assert.ok(!needsCompression({ bytes: 400_000, width: 1600, height: 1200 }, { maxBytes: 800_000 }));
  });

  it("recompresse une image trop lourde", () => {
    assert.ok(needsCompression({ bytes: 4_000_000, width: 1600, height: 1200 }, { maxBytes: 800_000 }));
  });

  it("recompresse une image légère mais démesurée", () => {
    assert.ok(needsCompression({ bytes: 200_000, width: 6000, height: 4000 }, { maxBytes: 800_000 }));
  });
});

describe("Résumé montré à l'utilisateur", () => {
  it("dit ce qui a été gagné", () => {
    assert.equal(
      compressionSummary({ width: 2048, height: 1536, bytes: 620_000, originalBytes: 4_200_000, recompressed: true }),
      "2048 × 1536 px · 4,2 Mo → 620 Ko · compressée automatiquement",
    );
  });

  it("dit quand rien n'a été touché", () => {
    assert.equal(
      compressionSummary({ width: 1200, height: 900, bytes: 340_000, originalBytes: 340_000, recompressed: false }),
      "1200 × 900 px · 340 Ko · qualité d'origine conservée",
    );
  });
});

describe("Envoi groupé", () => {
  it("regroupe les photos sous la limite d'une requête", () => {
    assert.deepEqual(chunkByBytes([700_000, 700_000, 700_000, 700_000], 2_000_000), [[0, 1], [2, 3]]);
  });

  it("laisse partir seule une photo plus lourde que le budget", () => {
    assert.deepEqual(chunkByBytes([100_000, 3_000_000, 100_000], 2_000_000), [[0], [1], [2]]);
  });

  it("rend un groupe vide pour une liste vide et couvre chaque index une fois", () => {
    assert.deepEqual(chunkByBytes([], BATCH_MAX_BYTES), []);
    const sizes = [500_000, 900_000, 200_000, 1_900_000, 50_000];
    const flat = chunkByBytes(sizes).flat();
    assert.deepEqual(flat, [0, 1, 2, 3, 4]);
  });
});
