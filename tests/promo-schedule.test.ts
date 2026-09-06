import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSchedule,
  isDue,
  isPending,
  parseScheduleInput,
  scheduleLabel,
  toScheduleInput,
} from "../src/lib/promo-schedule";

test("programmation — champ vide = publication immédiate", () => {
  assert.equal(parseScheduleInput(""), null);
  assert.equal(parseScheduleInput(null), null);
  assert.equal(parseScheduleInput("   "), null);
  assert.equal(isDue(null), true);
});

test("programmation — heure d'hiver interprétée en heure de Paris (UTC+1)", () => {
  const d = parseScheduleInput("2027-01-15T09:00");
  assert.ok(d);
  assert.equal(d.toISOString(), "2027-01-15T08:00:00.000Z");
});

test("programmation — heure d'été interprétée en heure de Paris (UTC+2)", () => {
  const d = parseScheduleInput("2027-07-15T09:00");
  assert.ok(d);
  assert.equal(d.toISOString(), "2027-07-15T07:00:00.000Z");
});

test("programmation — minuit ne bascule pas d'un jour", () => {
  const d = parseScheduleInput("2027-03-10T00:00");
  assert.ok(d);
  assert.equal(d.toISOString(), "2027-03-09T23:00:00.000Z");
});

test("programmation — aller-retour avec le champ du formulaire", () => {
  for (const value of ["2027-01-15T09:00", "2027-07-15T18:30", "2027-12-31T23:45"]) {
    assert.equal(toScheduleInput(parseScheduleInput(value)), value);
  }
  assert.equal(toScheduleInput(null), "");
});

test("programmation — une saisie illisible est refusée, jamais ignorée", () => {
  assert.throws(() => parseScheduleInput("demain matin"));
  assert.throws(() => parseScheduleInput("2027-13-45T99:99"));
  assert.throws(() => parseScheduleInput("2027-01-15"));
});

test("programmation — échéance atteinte", () => {
  const at = new Date("2027-01-15T08:00:00.000Z");
  assert.equal(isDue(at, new Date("2027-01-15T07:59:59.000Z")), false);
  assert.equal(isDue(at, at), true);
  assert.equal(isDue(at, new Date("2027-01-15T08:00:01.000Z")), true);
  assert.equal(isPending(at, new Date("2027-01-15T07:00:00.000Z")), true);
});

test("programmation — libellé en heure de Paris", () => {
  assert.equal(formatSchedule(new Date("2027-01-15T08:00:00.000Z")), "le 15 janvier 2027 à 09:00");
  assert.equal(formatSchedule(new Date("2027-07-15T07:00:00.000Z")), "le 15 juillet 2027 à 09:00");
  assert.equal(formatSchedule(null), null);
  assert.equal(
    scheduleLabel(new Date("2027-01-15T08:00:00.000Z")),
    "Publication programmée le 15 janvier 2027 à 09:00"
  );
  assert.equal(scheduleLabel(null), null);
});
