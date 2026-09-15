import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  gtagConfigScript,
  gtagSrc,
  isTrackedPath,
  normalizeMeasurementId,
  normalizeSiteVerification,
} from "../src/lib/analytics";

describe("Identifiant de mesure GA4", () => {
  it("accepte un identifiant de flux", () => {
    assert.equal(normalizeMeasurementId("G-ABC1234567"), "G-ABC1234567");
    assert.equal(normalizeMeasurementId("  g-abc1234567  "), "G-ABC1234567");
  });

  it("refuse une saisie vide ou absente", () => {
    assert.equal(normalizeMeasurementId(""), "");
    assert.equal(normalizeMeasurementId(null), "");
    assert.equal(normalizeMeasurementId(undefined), "");
    assert.equal(normalizeMeasurementId("   "), "");
  });

  it("refuse Universal Analytics, arrêté depuis 2023", () => {
    assert.equal(normalizeMeasurementId("UA-12345-1"), "");
  });

  it("refuse tout ce qui pourrait s'échapper du script en ligne", () => {
    for (const payload of [
      "G-ABC12345');alert(1);//",
      "G-ABC12345</script><script>alert(1)</script>",
      'G-ABC"12345',
      "G-ABC 12345",
      "<script>alert(1)</script>",
    ]) {
      assert.equal(normalizeMeasurementId(payload), "", `accepté à tort : ${payload}`);
    }
  });
});

describe("Balises gtag.js", () => {
  it("ne rend rien sans identifiant valide", () => {
    assert.equal(gtagSrc(""), "");
    assert.equal(gtagSrc("UA-12345-1"), "");
    assert.equal(gtagConfigScript(""), "");
    assert.equal(gtagConfigScript("pas-un-identifiant"), "");
  });

  it("charge gtag.js depuis Google avec l'identifiant configuré", () => {
    assert.equal(
      gtagSrc("G-ABC1234567"),
      "https://www.googletagmanager.com/gtag/js?id=G-ABC1234567",
    );
  });

  it("produit un script d'amorçage qui ne peut pas être refermé", () => {
    const script = gtagConfigScript("G-ABC1234567");
    assert.ok(script.includes("gtag('config','G-ABC1234567');"));
    assert.ok(!script.includes("</script"));
    assert.ok(!script.includes("<"));
  });
});

describe("Pages mesurées", () => {
  it("mesure les pages publiques", () => {
    for (const path of ["/", "/annuaire", "/promotions", "/adherents/12-au-bon-pain", "/association"]) {
      assert.equal(isTrackedPath(path), true, `devrait être mesurée : ${path}`);
    }
  });

  it("ne mesure ni le backoffice, ni l'espace adhérent, ni les URLs privées", () => {
    for (const path of [
      "/backend",
      "/backend/espace/promotions",
      "/login",
      "/inscription/adherent",
      "/api/social/facebook/callback",
    ]) {
      assert.equal(isTrackedPath(path), false, `ne devrait pas être mesurée : ${path}`);
    }
  });

  it("ne confond pas un préfixe avec un début de mot", () => {
    assert.equal(isTrackedPath("/backendeur"), true);
    assert.equal(isTrackedPath("/apiculteurs"), true);
  });
});

describe("Jeton Search Console", () => {
  it("accepte le jeton livré par Google", () => {
    assert.equal(
      normalizeSiteVerification("  aBc123_def-456ghijkl  "),
      "aBc123_def-456ghijkl",
    );
  });

  it("refuse une balise complète ou tout autre collage", () => {
    for (const payload of [
      '<meta name="google-site-verification" content="abc">',
      "",
      "trop-court",
      "abc123 def456ghij",
      "abc\"><script>alert(1)</script>",
    ]) {
      assert.equal(normalizeSiteVerification(payload), "", `accepté à tort : ${payload}`);
    }
  });
});
