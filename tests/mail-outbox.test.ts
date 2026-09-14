import { test } from "node:test";
import assert from "node:assert/strict";

import { MAX_ATTEMPTS, backoffDelayMs, shouldGiveUp } from "../src/lib/mail-outbox";

test("l'attente entre deux tentatives croît et reste plafonnée", () => {
  const delays = [1, 2, 3, 4, 5].map(backoffDelayMs);
  for (let i = 1; i < delays.length; i += 1) {
    assert.ok(delays[i] > delays[i - 1], `la tentative ${i + 1} devrait attendre plus longtemps`);
  }
  assert.equal(backoffDelayMs(1), 2 * 60_000);
  assert.equal(backoffDelayMs(4), 16 * 60_000);
  // Au-delà du plafond, l'attente ne double plus indéfiniment.
  assert.equal(backoffDelayMs(50), backoffDelayMs(MAX_ATTEMPTS));
});

test("une valeur aberrante ne produit pas une attente absurde", () => {
  assert.equal(backoffDelayMs(0), backoffDelayMs(1));
  assert.equal(backoffDelayMs(-3), backoffDelayMs(1));
  assert.ok(Number.isFinite(backoffDelayMs(1000)));
});

test("on abandonne après cinq tentatives, pas avant", () => {
  assert.equal(shouldGiveUp(1), false);
  assert.equal(shouldGiveUp(MAX_ATTEMPTS - 1), false);
  assert.equal(shouldGiveUp(MAX_ATTEMPTS), true);
  assert.equal(shouldGiveUp(MAX_ATTEMPTS + 1), true);
});
