import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  assessFacebookDebugToken,
  facebookWarningText,
  isAuthFailureSinceConnection,
  linkedinNeedsRefresh,
  linkedinRefreshUpdate,
} from "../src/lib/social-tokens";

const NOW = new Date("2026-11-18T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("LinkedIn : quand rafraîchir", () => {
  it("ne rafraîchit pas un jeton sans échéance", () => {
    assert.equal(linkedinNeedsRefresh(null, NOW), false);
  });
  it("attend tant qu'il reste plus de 30 jours", () => {
    assert.equal(linkedinNeedsRefresh(days(40), NOW), false);
  });
  it("rafraîchit sous 30 jours", () => {
    assert.equal(linkedinNeedsRefresh(days(29), NOW), true);
  });
  it("rafraîchit un jeton déjà expiré", () => {
    assert.equal(linkedinNeedsRefresh(days(-1), NOW), true);
  });
});

describe("LinkedIn : lecture de la réponse de rafraîchissement", () => {
  it("repousse l'échéance de 60 jours", () => {
    const u = linkedinRefreshUpdate({ access_token: "a", expires_in: 5_184_000 }, NOW);
    assert.equal(u.expiresAt.getTime(), days(60).getTime());
    assert.equal(u.refreshToken, null);
    assert.equal(u.refreshExpiresAt, null);
  });
  it("lit la fin de validité du refresh token", () => {
    const u = linkedinRefreshUpdate(
      { access_token: "a", expires_in: 5_184_000, refresh_token: "r", refresh_token_expires_in: 86_400 },
      NOW
    );
    assert.equal(u.refreshToken, "r");
    assert.equal(u.refreshExpiresAt?.getTime(), days(1).getTime());
  });
  it("prend 60 jours par défaut sans expires_in", () => {
    const u = linkedinRefreshUpdate({ access_token: "a" }, NOW);
    assert.equal(u.expiresAt.getTime(), days(60).getTime());
  });
  it("refuse une réponse sans access_token", () => {
    assert.throws(() => linkedinRefreshUpdate({ expires_in: 10 }, NOW), /access_token/);
  });
});

describe("Facebook : jeton collé à la main", () => {
  it("accepte un jeton système sans expiration sans avertir", () => {
    assert.deepEqual(assessFacebookDebugToken({ is_valid: true, type: "SYSTEM_USER", expires_at: 0 }), {
      ok: true,
      warning: null,
    });
  });
  it("avertit pour un jeton utilisateur personnel", () => {
    assert.deepEqual(assessFacebookDebugToken({ is_valid: true, type: "USER", expires_at: 0 }), {
      ok: true,
      warning: "personal",
    });
  });
  it("avertit pour un jeton système qui expire", () => {
    assert.deepEqual(
      assessFacebookDebugToken({ is_valid: true, type: "SYSTEM_USER", expires_at: 1_900_000_000 }),
      { ok: true, warning: "personal" }
    );
  });
  it("refuse un jeton invalide", () => {
    const r = assessFacebookDebugToken({ is_valid: false, error: { message: "expired" } });
    assert.equal(r.ok, false);
  });
  it("signale un jeton non vérifiable", () => {
    assert.deepEqual(assessFacebookDebugToken(undefined), { ok: true, warning: "unverified" });
  });
  it("n'affiche que les codes connus", () => {
    assert.ok(facebookWarningText("personal"));
    assert.equal(facebookWarningText("constructor"), null);
    assert.equal(facebookWarningText("<b>faux</b>"), null);
    assert.equal(facebookWarningText(undefined), null);
  });
});

describe("Tableau de bord : échec de publication lié au jeton", () => {
  const failed = (createdAt: Date, error = "OAuthException: session invalidated") => ({
    status: "failed",
    error,
    createdAt,
  });
  it("ignore un échec antérieur à la reconnexion", () => {
    assert.equal(isAuthFailureSinceConnection(failed(days(-2)), days(-1)), false);
  });
  it("retient un échec postérieur à la reconnexion", () => {
    assert.equal(isAuthFailureSinceConnection(failed(days(-1)), days(-2)), true);
  });
  it("retient l'échec si la date de connexion est inconnue", () => {
    assert.equal(isAuthFailureSinceConnection(failed(days(-1)), null), true);
  });
  it("ignore une erreur sans rapport avec le jeton", () => {
    assert.equal(isAuthFailureSinceConnection(failed(days(-1), "image trop grande"), null), false);
  });
  it("ignore une publication réussie", () => {
    assert.equal(
      isAuthFailureSinceConnection({ status: "published", error: null, createdAt: days(-1) }, null),
      false
    );
  });
});
