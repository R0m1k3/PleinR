import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultProtocol, originFromHeaders } from "../src/lib/site-url";

function headersOf(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null };
}

test("l'origine suit les en-têtes du reverse proxy", () => {
  assert.equal(
    originFromHeaders(headersOf({ host: "pleinr-app:3000", "x-forwarded-host": "pleinr.example.fr", "x-forwarded-proto": "https" })),
    "https://pleinr.example.fr"
  );
});

test("une liste d'hôtes transmis retient le premier", () => {
  assert.equal(
    originFromHeaders(headersOf({ "x-forwarded-host": "pleinr.example.fr, proxy.interne", "x-forwarded-proto": "https, http" })),
    "https://pleinr.example.fr"
  );
});

test("un accès direct en HTTP sur une IP reste en HTTP", () => {
  assert.equal(originFromHeaders(headersOf({ host: "0.0.0.0:3000" })), "http://0.0.0.0:3000");
  assert.equal(originFromHeaders(headersOf({ host: "192.168.1.20:8413" })), "http://192.168.1.20:8413");
  assert.equal(originFromHeaders(headersOf({ host: "localhost:3000", "x-forwarded-proto": "http" })), "http://localhost:3000");
});

test("un nom de domaine sans indication de protocole est présumé en HTTPS", () => {
  assert.equal(originFromHeaders(headersOf({ host: "pleinr.example.fr" })), "https://pleinr.example.fr");
  assert.equal(defaultProtocol("pleinr.example.fr:8443"), "https");
  assert.equal(defaultProtocol("[::1]:3000"), "http");
});

test("un en-tête absent ou malformé ne produit rien", () => {
  assert.equal(originFromHeaders(headersOf({})), "");
  assert.equal(originFromHeaders(headersOf({ host: "bad host/with path" })), "");
  assert.equal(originFromHeaders(headersOf({ host: "pleinr.example.fr", "x-forwarded-proto": "ftp" })), "https://pleinr.example.fr");
});
