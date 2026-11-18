import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { isDisplayable, normalizeText, parseSlot, validateSpotlight } from "../src/lib/spotlights";
import { decodeImageDataUri } from "../src/lib/data-uri";

describe("Carrousel de l'accueil : emplacements", () => {
  it("n'accepte que les emplacements 1 à 4", () => {
    for (const raw of ["0", "5", "a", "", "2.5", "12"]) assert.equal(parseSlot(raw), null, raw);
    assert.equal(parseSlot("1"), 1);
    assert.equal(parseSlot("4"), 4);
  });
});

describe("Carrousel de l'accueil : validation", () => {
  it("refuse de publier sans texte", () => {
    assert.match(validateSpotlight({ published: true, name: "Boulangerie", text: "" }) ?? "", /requis/);
    assert.match(validateSpotlight({ published: true, name: " ", text: "Pain" }) ?? "", /requis/);
  });

  it("accepte un emplacement vide non publié", () => {
    assert.equal(validateSpotlight({ published: false, name: "", text: "" }), null);
  });

  it("compte les retours à la ligne une seule fois", () => {
    const raw = ("a".repeat(49) + "\r\n").repeat(9) + "a".repeat(50); // 509 en brut, 500 normalisé
    const text = normalizeText(raw);
    assert.equal(text.length, 500);
    assert.equal(validateSpotlight({ published: true, name: "A", text }), null);
    assert.match(validateSpotlight({ published: true, name: "A", text: text + "y" }) ?? "", /trop long/);
  });

  it("limite le nom à 160 caractères", () => {
    assert.match(validateSpotlight({ published: false, name: "n".repeat(161), text: "" }) ?? "", /Nom trop long/);
  });
});

describe("Carrousel de l'accueil : affichage", () => {
  it("n'affiche qu'un emplacement publié et complet", () => {
    assert.equal(isDisplayable({ published: false, name: "A", text: "B" }), false);
    assert.equal(isDisplayable({ published: true, name: "  ", text: "B" }), false);
    assert.equal(isDisplayable({ published: true, name: "A", text: "" }), false);
    assert.equal(isDisplayable({ published: true, name: "A", text: "B" }), true);
  });
});

describe("Décodage des images en data-URI", () => {
  it("décode une image PNG", () => {
    const decoded = decodeImageDataUri("data:image/png;base64,iVBORw0KGgo=");
    assert.equal(decoded?.mime, "image/png");
    assert.equal(decoded?.bytes[1], 0x50); // « P » de PNG
  });

  it("refuse ce qui n'est pas une image matricielle", () => {
    assert.equal(decodeImageDataUri("data:text/html;base64,PGI+"), null);
    assert.equal(decodeImageDataUri("data:image/svg+xml;base64,PHN2Zz4="), null);
    assert.equal(decodeImageDataUri("https://exemple.fr/a.png"), null);
  });
});
