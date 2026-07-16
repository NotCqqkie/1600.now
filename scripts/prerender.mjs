#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const PREFERRED_PORT = Number(process.env.PRERENDER_PORT ?? 4173);
const PRERENDER_CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY ?? 1);
const PRERENDER_RETRY_CONCURRENCY = Number(process.env.PRERENDER_RETRY_CONCURRENCY ?? 1);
const PRERENDER_ATTEMPTS = Number(process.env.PRERENDER_ATTEMPTS ?? 3);
const PRERENDER_BROWSER_ROUTE_LIMIT = Number(process.env.PRERENDER_BROWSER_ROUTE_LIMIT ?? 25);
const PRERENDER_NAVIGATION_TIMEOUT_MS = Number(process.env.PRERENDER_NAVIGATION_TIMEOUT_MS ?? 60000);
const PRERENDER_READY_TIMEOUT_MS = Number(process.env.PRERENDER_READY_TIMEOUT_MS ?? 60000);
const PRERENDER_ROUTES = process.env.PRERENDER_ROUTES
  ?.split(",")
  .map((route) => route.trim())
  .filter(Boolean);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveStaticSpa() {
  return createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const filePath = path.resolve(dist, urlPath.replace(/^\/+/, ""));
      if (filePath !== dist && !filePath.startsWith(`${dist}${path.sep}`)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      if (existsSync(filePath) && !filePath.endsWith("/")) {
        const stat = await import("node:fs").then((m) => m.statSync(filePath));
        if (stat.isFile()) {
          const body = await readFile(filePath);
          res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
          res.end(body);
          return;
        }
      }
      const fallback = await readFile(
        path.join(dist, existsSync(path.join(dist, "spa-shell.html")) ? "spa-shell.html" : "index.html"),
      );
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fallback);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
}

async function listenServer() {
  const ports = PREFERRED_PORT === 0 ? [0] : [PREFERRED_PORT, 0];
  let lastError = null;

  for (const port of ports) {
    const server = serveStaticSpa();
    try {
      await new Promise((resolve, reject) => {
        const onError = (err) => {
          server.off("listening", onListening);
          reject(err);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, "127.0.0.1");
      });
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      return { server, port: actualPort };
    } catch (err) {
      lastError = err;
      server.close();
      if (err.code !== "EADDRINUSE") throw err;
    }
  }

  throw lastError;
}

export function urlsFromSitemap() {
  const indexXml = readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
  const childUrls = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pageUrls = [];
  for (const childUrl of childUrls) {
    const childFile = path.join(root, "public", new URL(childUrl).pathname.replace(/^\//, ""));
    const childXml = readFileSync(childFile, "utf8");
    for (const m of childXml.matchAll(/<loc>([^<]+)<\/loc>/g)) pageUrls.push(m[1]);
  }
  return pageUrls.map((u) => new URL(u).pathname);
}

export function outputPathFor(route) {
  if (route === "/") return path.join(dist, "index.html");
  return path.join(dist, `${route.replace(/^\/|\/$/g, "")}.html`);
}

const CORE_MODULE_PRELOAD_PATTERN =
  /\/assets\/(?:rolldown-runtime-|jsx-runtime-|react-dom-)[^/]*\.js(?:\?|$)/;
const PRACTICE_INDEX_PRELOAD_PATTERN =
  /\/assets\/bank-practice-index-[^/]*\.js(?:\?|$)/;

const routeChunkRules = [
  { matches: (route) => route === "/", chunks: ["Home"] },
  { matches: (route) => route === "/modules", chunks: ["Modules"] },
  { matches: (route) => route === "/score-calculator", chunks: ["ScoreCalculator"] },
  { matches: (route) => route === "/bank", chunks: ["BankIndex"] },
  { matches: (route) => route === "/vocab", chunks: ["Vocab"] },
  { matches: (route) => route === "/hard", chunks: ["HardQuestionsIntro"] },
  { matches: (route) => route === "/sat-vocabulary", chunks: ["SatVocabularyIndex"] },
  { matches: (route) => route === "/sat-score", chunks: ["SatScoreIndex"] },
  { matches: (route) => route.startsWith("/sat-score/"), chunks: ["SatScoreDetail"] },
  { matches: (route) => route === "/sat-skill", chunks: ["SatSkillIndex"] },
  { matches: (route) => route.startsWith("/sat-skill/"), chunks: ["SatSkillDetail"] },
  { matches: (route) => route === "/blog", chunks: ["BlogIndex"] },
  { matches: (route) => route.startsWith("/blog/"), chunks: ["BlogPost"] },
  { matches: (route) => route === "/sat-faq", chunks: ["SatFaqIndex"] },
  { matches: (route) => route.startsWith("/sat-faq/"), chunks: ["SatFaqPage"] },
  {
    matches: (route) => /^\/is-a-\d+-a-good-sat-score$/.test(route),
    chunks: ["IsScoreGood"],
  },
  { matches: (route) => route === "/privacy", chunks: ["PrivacyPolicy"] },
  { matches: (route) => route === "/terms", chunks: ["TermsOfService"] },
  { matches: (route) => route === "/about", chunks: ["AboutPage"] },
  { matches: (route) => route === "/sat-to-act-converter", chunks: ["SatToActConverter"] },
  {
    matches: (route) => route === "/sat-percentile-calculator",
    chunks: ["SatPercentileCalculator"],
  },
  { matches: (route) => route === "/psat-to-sat-predictor", chunks: ["PsatToSatPredictor"] },
  {
    matches: (route) => route === "/sat-study-plan-generator",
    chunks: ["SatStudyPlanGenerator"],
  },
  {
    matches: (route) => route === "/what-sat-score-do-i-need",
    chunks: ["WhatSatScoreDoINeed"],
  },
  { matches: (route) => route === "/sat-test-countdown", chunks: ["SatTestCountdown"] },
  { matches: (route) => route === "/in" || route === "/ae", chunks: ["CountryHubPage"] },
  {
    matches: (route) => route.startsWith("/in/") || route.startsWith("/ae/"),
    chunks: ["CountryTopicPage"],
  },
  { matches: (route) => route === "/college", chunks: ["CollegeIndex"] },
  { matches: (route) => route.startsWith("/college/"), chunks: ["CollegePage"] },
];

function getTagAttribute(tag, attribute) {
  return tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2] ?? "";
}

function setTagAttribute(tag, attribute, value) {
  return tag.replace(
    new RegExp(`(\\b${attribute}\\s*=\\s*)(["'])(.*?)\\2`, "i"),
    (_, prefix, quote) => `${prefix}${quote}${value}${quote}`,
  );
}

function normalizeLocalAssetHref(href) {
  try {
    const url = new URL(href);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {}
  return href;
}

export function collectModulePreloadHrefs(html) {
  return new Set(
    [...html.matchAll(/<link\b[^>]*\brel=(["'])modulepreload\1[^>]*>/gi)].map((match) =>
      normalizeLocalAssetHref(getTagAttribute(match[0], "href")),
    ),
  );
}

function routeChunkNames(route) {
  const matched = routeChunkRules.find((rule) => rule.matches(route));
  if (matched) return matched.chunks;
  return route.split("/").filter(Boolean).length === 1 ? ["TopLevelSeoPage"] : [];
}

function isAllowedModulePreload(href, route, shellPreloads) {
  if (shellPreloads?.has(href) && !PRACTICE_INDEX_PRELOAD_PATTERN.test(href)) return true;
  if (CORE_MODULE_PRELOAD_PATTERN.test(href)) return true;
  if (route === "/modules" && PRACTICE_INDEX_PRELOAD_PATTERN.test(href)) return true;

  const filename = href.split("/").pop() ?? "";
  return routeChunkNames(route).some((chunk) => filename.startsWith(`${chunk}-`));
}

export function pruneRoutePreloads(html, route, metrics = null, shellPreloads = null) {
  let kept = 0;
  let removed = 0;
  const pruned = html.replace(/<link\b[^>]*\brel=(["'])modulepreload\1[^>]*>/gi, (linkTag) => {
    const href = normalizeLocalAssetHref(getTagAttribute(linkTag, "href"));
    if (isAllowedModulePreload(href, route, shellPreloads)) {
      kept++;
      return setTagAttribute(linkTag, "href", href);
    }
    removed++;
    return "";
  });

  if (metrics) {
    metrics.kept += kept;
    metrics.removed += removed;
  }

  if (route !== "/") return pruned;
  return pruned.replace(/<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>/gi, (linkTag) =>
    /\/assets\/mathRendering-[^"']*\.css/.test(linkTag) ? "" : linkTag,
  );
}

export function normalizeLocalAssetUrls(html) {
  return html.replace(
    /(\b(?:href|src)\s*=\s*["'])https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(\/[^"']*)/gi,
    "$1$2",
  );
}

function replaceTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
}

function stripPageSeo(html) {
  return html
    .replace(/<link\b[^>]*\brel=(["'])canonical\1[^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      const name = getTagAttribute(tag, "name").toLowerCase();
      const property = getTagAttribute(tag, "property").toLowerCase();
      if (["description", "keywords", "robots", "googlebot"].includes(name)) return "";
      if (name.startsWith("twitter:") || property.startsWith("og:")) return "";
      return tag;
    })
    .replace(/<script\b[^>]*\btype=(["'])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>\s*/gi, "");
}

export function createSpaShellHtml(shellHtml) {
  if (!/<div\s+id=(["'])root\1\s*>\s*<\/div>/i.test(shellHtml)) {
    throw new Error("dist/index.html is already rendered; run Vite build before prerendering again");
  }
  return replaceTitle(stripPageSeo(shellHtml), "1600.now");
}

export function create404Html(shellHtml) {
  const static404 = `<div id="root"><main style="min-height:100vh;display:grid;place-items:center;padding:2rem;background:#f8fafc;color:#172033;font-family:Inter,system-ui,sans-serif"><div style="max-width:28rem;text-align:center"><p style="margin:0;color:#2957a4;font-size:6rem;font-weight:800;line-height:1">404</p><h1 style="margin:1rem 0 .5rem;font-size:1.5rem">Page not found</h1><p style="margin:0 0 1.5rem;line-height:1.6;color:#526079">This page doesn't exist or may have moved.</p><a href="/" style="color:#2957a4;font-weight:700">Back to home</a></div></main></div>`;
  return replaceTitle(createSpaShellHtml(shellHtml), "Page Not Found | 1600.now")
    .replace(
      "</head>",
      '    <meta name="robots" content="noindex, follow" />\n    <meta name="googlebot" content="noindex, follow" />\n  </head>',
    )
    .replace(/<div\s+id=(["'])root\1\s*>\s*<\/div>/i, static404);
}

export function createDeploymentShells(shellHtml) {
  const shellPreloads = collectModulePreloadHrefs(shellHtml);
  return {
    spaShell: pruneRoutePreloads(
      createSpaShellHtml(shellHtml),
      "/__spa-shell__",
      null,
      shellPreloads,
    ),
    notFound: pruneRoutePreloads(
      create404Html(shellHtml),
      "/__404__",
      null,
      shellPreloads,
    ),
  };
}

export function selectPrerenderRoutes(allRoutes, requestedRoutes = PRERENDER_ROUTES) {
  if (!requestedRoutes?.length) return allRoutes;
  const selected = [...new Set(requestedRoutes.map((route) => route === "" ? "/" : route))];
  const unknown = selected.filter((route) => !allRoutes.includes(route));
  if (unknown.length > 0) {
    throw new Error(`PRERENDER_ROUTES contains routes absent from the sitemap: ${unknown.join(", ")}`);
  }
  return selected;
}

async function main() {
  if (!existsSync(dist)) {
    console.error("dist/ not found. Run `npm run build` first.");
    process.exit(1);
  }

  const indexHtml = readFileSync(path.join(dist, "index.html"), "utf8");
  const shellHtml = /<div\s+id=(["'])root\1\s*>\s*<\/div>/i.test(indexHtml)
    ? indexHtml
    : readFileSync(path.join(dist, "spa-shell.html"), "utf8");
  const shellPreloads = collectModulePreloadHrefs(shellHtml);
  const deploymentShells = createDeploymentShells(shellHtml);
  writeFileSync(path.join(dist, "spa-shell.html"), deploymentShells.spaShell);
  writeFileSync(path.join(dist, "404.html"), deploymentShells.notFound);

  const allRoutes = urlsFromSitemap();
  const routes = selectPrerenderRoutes(allRoutes);
  console.log(`Prerendering ${routes.length} routes...`);
  const preloadMetrics = { kept: 0, removed: 0 };

  const { server, port } = await listenServer();
  const launchArgs = process.env.PRERENDER_NO_SANDBOX === "1"
    ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    : [];
  const launchBrowser = () =>
    puppeteer.launch({
      headless: true,
      args: launchArgs,
      protocolTimeout: 180_000,
    });

  const closeBrowser = async (browser) => {
    const browserProcess = browser.process();
    if (browser.isConnected()) {
      await browser.close().catch(() => {});
    }
    if (browserProcess && browserProcess.exitCode === null && browserProcess.signalCode === null) {
      browserProcess.kill("SIGKILL");
    }
  };

  let done = 0;

  async function preparePage(page) {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const requestUrl = request.url();
      if (
        requestUrl.startsWith(`http://127.0.0.1:${port}/`) ||
        requestUrl.startsWith("data:") ||
        requestUrl.startsWith("blob:")
      ) {
        request.continue();
        return;
      }
      request.abort();
    });
  }

  async function renderRoute(page, route) {
    await page.goto(`http://127.0.0.1:${port}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: PRERENDER_NAVIGATION_TIMEOUT_MS,
    });
    await page.waitForFunction(
      (routePath) => {
        const root = document.getElementById("root");
        if (!root) return false;
        if (root.querySelector(".animate-spin")) return false;
        const text = root.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const emptyRouteShell =
          root.querySelector(":scope > .min-h-screen.bg-background") && text.length < 300;
        const canonicalReady =
          routePath === "/" ||
          Boolean(
            document.querySelector('link[rel="canonical"]')?.href.endsWith(routePath),
          );
        return (
          !emptyRouteShell && text.length > 300 && document.title.trim().length > 0 && canonicalReady
        );
      },
      { timeout: PRERENDER_READY_TIMEOUT_MS, polling: 100 },
      route,
    );
    await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => {
      const deferredFonts = document.querySelector("link[data-deferred-fonts]");
      if (deferredFonts) deferredFonts.rel = "preload";
    });
    const html = normalizeLocalAssetUrls(await page.content());
    const out = outputPathFor(route);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, pruneRoutePreloads(html, route, preloadMetrics, shellPreloads));
  }

  async function runBatch(batchRoutes, concurrency, attempt) {
    const failures = [];

    for (let start = 0; start < batchRoutes.length; start += PRERENDER_BROWSER_ROUTE_LIMIT) {
      const chunkRoutes = batchRoutes.slice(start, start + PRERENDER_BROWSER_ROUTE_LIMIT);
      const browser = await launchBrowser();
      let browserDisconnected = false;
      browser.on("disconnected", () => {
        browserDisconnected = true;
      });

      let cursor = 0;

      async function worker() {
        while (true) {
          const i = cursor++;
          if (i >= chunkRoutes.length) break;
          const route = chunkRoutes[i];
          let page = null;
          try {
            if (browserDisconnected || !browser.isConnected()) {
              throw new Error("Browser disconnected");
            }
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 900 });
            await preparePage(page);
            await renderRoute(page, route);
            done++;
            if (done % 25 === 0) console.log(`  ${done}/${routes.length}`);
          } catch (err) {
            failures.push({ route, message: err.message });
            const prefix = attempt === 1 ? "fail" : `fail retry ${attempt}`;
            console.warn(`  ${prefix} ${route}: ${err.message}`);
          } finally {
            if (page) {
              await page.close().catch(() => {});
            }
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, chunkRoutes.length) }, () => worker()),
      );
      await closeBrowser(browser);
    }

    return failures;
  }

  let failures = routes.map((route) => ({ route, message: "" }));

  for (let attempt = 1; attempt <= PRERENDER_ATTEMPTS && failures.length > 0; attempt++) {
    const batchRoutes = failures.map((f) => f.route);
    if (attempt > 1) {
      console.log(`Retrying ${batchRoutes.length} failed routes (attempt ${attempt})...`);
    }
    failures = await runBatch(
      batchRoutes,
      attempt === 1 ? PRERENDER_CONCURRENCY : PRERENDER_RETRY_CONCURRENCY,
      attempt,
    );
  }

  await new Promise((r) => server.close(r));

  console.log(`Prerendered ${done} routes (${failures.length} failed).`);
  console.log(
    `Modulepreloads kept: ${preloadMetrics.kept}; removed: ${preloadMetrics.removed}.`,
  );

  if (failures.length > 0) {
    console.error(
      failures.map((f) => `  ${f.route}: ${f.message}`).join("\n"),
    );
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
