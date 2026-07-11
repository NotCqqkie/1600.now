import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoLoopbackUrls,
  normalizeLoopbackAttributeUrls,
  pruneLoopbackModulePreloads,
} from "./prerender-url-safety.mjs";

test("drops loopback modulepreloads and preserves relative core preloads", () => {
  const corePreloads = [
    '<link rel="modulepreload" href="/assets/index.js">',
    '<link rel="modulepreload" href="/assets/react.js">',
    '<link rel="modulepreload" href="/assets/router.js">',
    '<link rel="modulepreload" href="/assets/firebase.js">',
  ];
  const html = [
    ...corePreloads,
    '<link rel="modulepreload" href="http://127.0.0.1:4173/assets/Home.js">',
    '<link href="https://localhost/assets/BankIndex.js" rel="modulepreload">',
    '<link rel="modulepreload" href="https://cdn.example.com/assets/external.js">',
  ].join("");

  const pruned = pruneLoopbackModulePreloads(html);

  for (const preload of corePreloads) assert.ok(pruned.includes(preload));
  assert.doesNotMatch(pruned, /Home\.js|BankIndex\.js/);
  assert.match(pruned, /https:\/\/cdn\.example\.com\/assets\/external\.js/);
});

test("normalizes non-preload loopback href and src attributes", () => {
  const html = [
    '<script src="http://127.0.0.1:4173/assets/index.js?x=1#app"></script>',
    '<link rel="stylesheet" href="https://localhost/assets/app.css">',
    '<a href="http://localhost:8080/docs">Docs</a>',
  ].join("");

  const normalized = normalizeLoopbackAttributeUrls(html);

  assert.match(normalized, /src="\/assets\/index\.js\?x=1#app"/);
  assert.match(normalized, /href="\/assets\/app\.css"/);
  assert.match(normalized, /href="\/docs"/);
  assertNoLoopbackUrls(normalized);
});

test("leaves external and relative URLs unchanged", () => {
  const html = [
    '<script src="https://cdn.example.com/app.js"></script>',
    '<link rel="stylesheet" href="/assets/app.css">',
    '<a href="https://localhost.example.com/docs">External</a>',
  ].join("");

  assert.equal(normalizeLoopbackAttributeUrls(html), html);
  assertNoLoopbackUrls(html);
});

test("fails when a loopback URL remains", () => {
  assert.throws(
    () => assertNoLoopbackUrls('<link rel="modulepreload" href="http://127.0.0.1:4173/assets/app.js">', "/bank"),
    /\/bank contains loopback URLs/,
  );
});
