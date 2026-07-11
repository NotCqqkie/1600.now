import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  collectModulePreloadHrefs,
  create404Html,
  createDeploymentShells,
  createSpaShellHtml,
  normalizeLocalAssetUrls,
  pruneRoutePreloads,
  selectPrerenderRoutes,
} from "./prerender.mjs";

const shell = `<!doctype html><html><head>
<title>Homepage title</title>
<meta name="description" content="Homepage description">
<meta name="robots" content="index, follow">
<meta property="og:title" content="Homepage title">
<meta name="twitter:title" content="Homepage title">
<link rel="canonical" href="https://1600.now/">
<script type="application/ld+json">{"@type":"WebSite"}</script>
</head><body><div id="root"></div><script type="module" src="/assets/index-test.js"></script></body></html>`;

test("SPA shell does not leak homepage search metadata", () => {
  const output = createSpaShellHtml(shell);
  assert.match(output, /<title>1600\.now<\/title>/);
  assert.doesNotMatch(output, /canonical|description|name="robots"|og:|twitter:|ld\+json/);
  assert.match(output, /src="\/assets\/index-test\.js"/);
});

test("custom 404 is crawl-safe and useful without JavaScript", () => {
  const output = create404Html(shell);
  assert.match(output, /<title>Page Not Found \| 1600\.now<\/title>/);
  assert.match(output, /name="robots" content="noindex, follow"/);
  assert.match(output, />404</);
  assert.match(output, /href="\/"/);
  assert.doesNotMatch(output, /rel="canonical"/);
});

test("deployment shells drop application-only entry preloads", () => {
  const shellWithPreloads = shell.replace(
    "</head>",
    '<link rel="modulepreload" href="/assets/rolldown-runtime-a.js"><link rel="modulepreload" href="/assets/dist-router.js"><link rel="modulepreload" href="/assets/bank-practice-index-a.js"></head>',
  );
  const { spaShell, notFound } = createDeploymentShells(shellWithPreloads);
  for (const output of [spaShell, notFound]) {
    assert.match(output, /rolldown-runtime-a\.js/);
    assert.match(output, /dist-router\.js/);
    assert.doesNotMatch(output, /bank-practice-index-a\.js/);
  }
});

test("captured local asset URLs become deploy-safe root-relative URLs", () => {
  const output = normalizeLocalAssetUrls(
    '<link href="http://127.0.0.1:4173/assets/math.css"><script src="http://localhost:4173/assets/app.js"></script>',
  );
  assert.equal(
    output,
    '<link href="/assets/math.css"><script src="/assets/app.js"></script>',
  );
});

test("prerender keeps only core and current-route modulepreloads", () => {
  const html = `<head>
    <link rel="modulepreload" href="/assets/rolldown-runtime-a.js">
    <link rel="modulepreload" href="http://127.0.0.1:4173/assets/Home-a.js">
    <link rel="modulepreload" href="/assets/dist-router.js">
    <link rel="modulepreload" href="/assets/Question-a.js">
    <link rel="modulepreload" href="/assets/firebaseAuth-a.js">
    <link rel="modulepreload" href="/assets/bank-practice-index-a.js">
  </head>`;
  const metrics = { kept: 0, removed: 0 };
  const shellPreloads = collectModulePreloadHrefs(
    '<link rel="modulepreload" href="/assets/dist-router.js">',
  );
  const output = pruneRoutePreloads(html, "/", metrics, shellPreloads);
  assert.match(output, /rolldown-runtime-a\.js/);
  assert.match(output, /href="\/assets\/Home-a\.js"/);
  assert.match(output, /dist-router\.js/);
  assert.doesNotMatch(output, /127\.0\.0\.1/);
  assert.doesNotMatch(output, /Question-a|firebaseAuth-a|bank-practice-index-a/);
  assert.deepEqual(metrics, { kept: 3, removed: 3 });

  const modulesOutput = pruneRoutePreloads(
    html.replace("Home-a.js", "Modules-a.js"),
    "/modules",
    null,
    shellPreloads,
  );
  assert.match(modulesOutput, /Modules-a\.js/);
  assert.match(modulesOutput, /bank-practice-index-a\.js/);
});

test("focused prerender route selection rejects non-sitemap URLs", () => {
  assert.deepEqual(selectPrerenderRoutes(["/", "/bank"], ["/bank", "/bank"]), ["/bank"]);
  assert.throws(
    () => selectPrerenderRoutes(["/", "/bank"], ["/missing"]),
    /absent from the sitemap/,
  );
});

test("Firebase Hosting uses narrow SPA rewrites and permanent legacy redirects", () => {
  const config = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
  const { redirects, rewrites, headers } = config.hosting;

  assert.ok(redirects.some((rule) => rule.source === "/browse" && rule.destination === "/bank" && rule.type === 301));
  assert.ok(
    redirects.some(
      (rule) =>
        rule.regex?.includes("(?P<score>") &&
        rule.destination === "/sat-score/:score" &&
        rule.type === 301,
    ),
  );
  assert.ok(rewrites.some((rule) => rule.source === "/bank/**"));
  assert.ok(rewrites.some((rule) => rule.source === "/practice-tests{,/**}"));
  assert.ok(!rewrites.some((rule) => rule.source?.includes("vocab")));
  assert.ok(!rewrites.some((rule) => rule.source === "**" || rule.source?.startsWith("!")));
  assert.ok(
    headers.some((rule) =>
      rule.headers?.some((header) => header.key === "X-Robots-Tag" && header.value === "noindex, follow"),
    ),
  );
});
