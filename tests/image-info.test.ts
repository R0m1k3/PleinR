import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  aspectLabel,
  formatBytes,
  imageNotes,
  imageSummary,
  isSquare,
  orientationLabel,
  IDEAL_SIDE,
} from "../src/lib/image-info";

describe("Poids d'un fichier", () => {
  it("passe des octets aux kilo-octets puis aux méga-octets", () => {
    assert.equal(formatBytes(640), "640 o");
    assert.equal(formatBytes(420_000), "420 Ko");
    assert.equal(formatBytes(1_200_000), "1,2 Mo");
  });

  it("ne rend rien pour une valeur absurde", () => {
    assert.equal(formatBytes(-1), "");
    assert.equal(formatBytes(Number.NaN), "");
  });
});

describe("Format d'une image", () => {
  it("reconnaît les formats courants", () => {
    assert.equal(aspectLabel(1080, 1080), "1:1");
    assert.equal(aspectLabel(1080, 1350), "4:5");
    assert.equal(aspectLabel(1920, 1080), "16:9");
  });

  it("tolère un écart de 2 % autour d'un format connu", () => {
    assert.equal(aspectLabel(1080, 1078), "1:1");
    assert.ok(isSquare({ width: 1080, height: 1078, bytes: 0 }));
  });

  it("approche les formats inhabituels plutôt que de rendre une fraction illisible", () => {
    assert.equal(aspectLabel(1000, 730), "1,37:1");
    assert.equal(aspectLabel(730, 1000), "1:1,37");
  });

  it("nomme l'orientation", () => {
    assert.equal(orientationLabel({ width: 1080, height: 1080, bytes: 0 }), "carré");
    assert.equal(orientationLabel({ width: 1080, height: 1350, bytes: 0 }), "portrait");
    assert.equal(orientationLabel({ width: 1350, height: 1080, bytes: 0 }), "paysage");
  });

  it("résume dimensions, format et poids", () => {
    assert.equal(
      imageSummary({ width: 1080, height: 1350, bytes: 420_000 }),
      "1080 × 1350 px · portrait 4:5 · 420 Ko"
    );
  });

  it("ne résume rien sans dimensions exploitables", () => {
    assert.equal(imageSummary({ width: 0, height: 0, bytes: 1000 }), "");
    assert.deepEqual(imageNotes({ width: 0, height: 0, bytes: 1000 }), []);
  });
});

describe("Remarques sur l'image déposée", () => {
  it("félicite une image carrée assez grande et assez légère", () => {
    const notes = imageNotes({ width: IDEAL_SIDE, height: IDEAL_SIDE, bytes: 300_000 });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].tone, "info");
  });

  it("prévient des bandes de couleur ajoutées par les réseaux hors du carré", () => {
    const notes = imageNotes({ width: 1080, height: 1350, bytes: 300_000 });
    assert.ok(notes.some((n) => n.tone === "warn" && /bandes de couleur/.test(n.text)));
    assert.ok(notes.some((n) => /4:5/.test(n.text)));
  });

  it("signale une image trop petite", () => {
    const notes = imageNotes({ width: 400, height: 400, bytes: 60_000 });
    assert.ok(notes.some((n) => /floue/.test(n.text)));
  });

  it("signale un fichier trop lourd", () => {
    const notes = imageNotes({ width: 1080, height: 1080, bytes: 3_000_000 });
    assert.ok(notes.some((n) => /Fichier lourd/.test(n.text)));
  });

  it("cumule les remarques quand tout se ligue", () => {
    const notes = imageNotes({ width: 600, height: 900, bytes: 3_000_000 });
    assert.equal(notes.length, 3);
    assert.ok(notes.every((n) => n.tone === "warn"));
  });
});
