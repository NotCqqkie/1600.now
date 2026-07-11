#!/usr/bin/env node

const baseUrl = process.env.HOSTING_BASE_URL ?? "http://127.0.0.1:5000";

async function request(pathname) {
  const response = await fetch(new URL(pathname, baseUrl), { redirect: "manual" });
  return { response, body: await response.text() };
}

async function expectStatus(pathname, status) {
  const result = await request(pathname);
  if (result.response.status !== status) {
    throw new Error(`${pathname}: expected ${status}, received ${result.response.status}`);
  }
  return result;
}

async function expectRedirect(pathname, destination) {
  const { response } = await expectStatus(pathname, 301);
  const location = response.headers.get("location");
  if (!location) throw new Error(`${pathname}: redirect is missing Location`);
  const actual = new URL(location, baseUrl);
  if (`${actual.pathname}${actual.search}` !== destination) {
    throw new Error(`${pathname}: expected redirect to ${destination}, received ${location}`);
  }
}

async function expectNoindexShell(pathname) {
  const { response, body } = await expectStatus(pathname, 200);
  if (response.headers.get("x-robots-tag") !== "noindex, follow") {
    throw new Error(`${pathname}: missing server-level noindex header`);
  }
  if (!body.includes("<title>1600.now</title>")) {
    throw new Error(`${pathname}: did not receive the neutral SPA shell`);
  }
  if (/rel=["']canonical["']/.test(body)) {
    throw new Error(`${pathname}: SPA shell contains a canonical URL`);
  }
}

await expectRedirect("/browse?utm_source=hosting-check", "/bank?utm_source=hosting-check");
await expectRedirect(
  "/is-a-1530-a-good-sat-score?utm_source=hosting-check",
  "/sat-score/1530?utm_source=hosting-check",
);
await expectRedirect(
  "/study-plan-lab?utm_source=hosting-check",
  "/sat-study-plan-generator?utm_source=hosting-check",
);

const bank = await expectStatus("/bank", 200);
if (!bank.body.includes('rel="canonical" href="https://1600.now/bank"')) {
  throw new Error("/bank: route-specific static canonical is missing");
}
if (bank.response.headers.has("x-robots-tag")) {
  throw new Error("/bank: indexable route received an X-Robots-Tag header");
}

await expectStatus("/sat-score/1530", 200);
await expectNoindexShell("/login");
await expectNoindexShell("/bank/math/browse");
await expectNoindexShell("/practice-tests/1/start");

const vocab = await expectStatus("/vocab", 200);
if (vocab.response.headers.has("x-robots-tag")) {
  throw new Error("/vocab: indexable client route received an X-Robots-Tag header");
}
if (!vocab.body.includes('rel="canonical" href="https://1600.now/vocab"')) {
  throw new Error("/vocab: route-specific static canonical is missing");
}

for (const pathname of [
  "/does-not-exist-technical-check",
  "/college/does-not-exist-technical-check",
  "/is-a-1535-a-good-sat-score",
]) {
  const { body } = await expectStatus(pathname, 404);
  if (!body.includes('name="robots" content="noindex, follow"')) {
    throw new Error(`${pathname}: custom 404 is missing noindex metadata`);
  }
  if (/rel=["']canonical["']/.test(body)) {
    throw new Error(`${pathname}: custom 404 contains a canonical URL`);
  }
}

console.log(`Technical SEO hosting checks passed against ${baseUrl}.`);
