import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  formatValidity,
  formatValidityShort,
  isExpired,
  isRangeInvalid,
} from "../src/lib/promo-validity";

describe("Période de validité d'une promotion", () => {
  it("affiche les deux bornes", () => {
    assert.equal(
      formatValidity({ startsOn: "2027-03-01", endsOn: "2027-03-15" }),
      "Valable du 1er au 15 mars 2027"
    );
  });

  it("ne répète pas l'année quand elle est identique", () => {
    assert.equal(
      formatValidity({ startsOn: "2027-03-01", endsOn: "2027-04-10" }),
      "Valable du 1er mars au 10 avril 2027"
    );
  });

  it("écrit les deux années quand elles diffèrent", () => {
    assert.equal(
      formatValidity({ startsOn: "2027-12-20", endsOn: "2028-01-05" }),
      "Valable du 20 décembre 2027 au 5 janvier 2028"
    );
  });

  it("gère une seule borne", () => {
    assert.equal(formatValidity({ endsOn: "2027-06-30" }), "Valable jusqu'au 30 juin 2027");
    assert.equal(
      formatValidity({ startsOn: "2027-06-01" }),
      "Valable à partir du 1er juin 2027"
    );
  });

  it("ne renvoie rien sans date ni texte : la carte n'affiche alors aucune mention", () => {
    assert.equal(formatValidity({}), null);
    assert.equal(formatValidity({ startsOn: null, endsOn: null, validUntil: "  " }), null);
  });

  it("retombe sur l'ancien texte libre des promotions existantes", () => {
    assert.equal(formatValidity({ validUntil: "Tout l'été" }), "Tout l'été");
    // Les dates priment sur le texte libre.
    assert.equal(
      formatValidity({ endsOn: "2027-07-31", validUntil: "Tout l'été" }),
      "Valable jusqu'au 31 juillet 2027"
    );
  });

  it("ignore une date illisible", () => {
    assert.equal(formatValidity({ endsOn: "pas-une-date" }), null);
    assert.equal(formatValidity({ endsOn: "2027-13-45" }), null);
  });

  it("propose une variante sans le mot « Valable »", () => {
    assert.equal(formatValidityShort({ endsOn: "2027-06-30" }), "jusqu'au 30 juin 2027");
  });

  it("considère le dernier jour comme encore valable", () => {
    const end = { endsOn: "2027-06-30" };
    assert.equal(isExpired(end, new Date("2027-06-30T23:00:00Z")), false);
    assert.equal(isExpired(end, new Date("2027-07-01T12:00:00Z")), true);
    assert.equal(isExpired({}, new Date("2099-01-01T00:00:00Z")), false);
  });

  it("détecte une fin antérieure au début", () => {
    assert.equal(isRangeInvalid({ startsOn: "2027-06-10", endsOn: "2027-06-01" }), true);
    assert.equal(isRangeInvalid({ startsOn: "2027-06-01", endsOn: "2027-06-01" }), false);
    assert.equal(isRangeInvalid({ startsOn: "2027-06-01" }), false);
  });
});
