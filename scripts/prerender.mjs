#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import {
  assertNoLoopbackUrls,
  normalizeLoopbackAttributeUrls,
  pruneLoopbackModulePreloads,
} from "./prerender-url-safety.mjs";

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
      const fallback = await readFile(path.join(dist, "index.html"));
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

function urlsFromSitemap() {
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

function outputPathFor(route) {
  if (route === "/") return path.join(dist, "index.html");
  return path.join(dist, `${route.replace(/^\/|\/$/g, "")}.html`);
}

// page.content() captures the modulepreload links Vite injects at runtime for
// dynamically imported chunks, which bakes lazy-loaded chunks into the HTML as
// eager preloads. Strip preloads for heavy chunks that load on demand anyway
// (practice-set data, the practice index, and the Firebase SDK chunks
// everywhere; the bank question graph outside /bank; the home page's
// below-the-fold demo graph) so they stop competing with the critical path.
// Stylesheet links are kept — the captured body needs them to paint correctly
// before hydration.
const HEAVY_LAZY_CHUNK_PATTERN =
  /\/assets\/(?:bank-practice-set-|bank-practice-index-|bank-data-past-|bank-data-unofficial-|pastQuestionDifficultyMap|index\.esm-)/;
const HOME_DEMO_CHUNK_PATTERN =
  /\/assets\/(?:Question-|questionBank-|mathRendering-|bank-data-images|bank-data-hidden|bank-categories)/;
const BANK_QUESTION_GRAPH_PATTERN =
  /\/assets\/(?:questionBank-|bank-data-images-)/;

function pruneHeavyPreloads(html, route) {
  const underBank = route === "/bank" || route.startsWith("/bank/");
  const withoutLoopbackPreloads = pruneLoopbackModulePreloads(html);
  const pruned = withoutLoopbackPreloads.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, (linkTag) => {
    const href = linkTag.match(/href="([^"]*)"/)?.[1] ?? "";
    if (HEAVY_LAZY_CHUNK_PATTERN.test(href)) return "";
    if (route === "/" && HOME_DEMO_CHUNK_PATTERN.test(href)) return "";
    if (!underBank && BANK_QUESTION_GRAPH_PATTERN.test(href)) return "";
    return linkTag;
  });

  // The home snapshot contains no KaTeX markup (the demo's math renders after
  // the lazy mathRendering module resolves), so its runtime-captured KaTeX
  // stylesheet link would only block first paint. The chunk re-injects the
  // stylesheet when it loads.
  if (route !== "/") return pruned;
  return pruned.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (linkTag) =>
    /\/assets\/mathRendering-[^"]*\.css/.test(linkTag) ? "" : linkTag,
  );
}

async function main() {
  if (!existsSync(dist)) {
    console.error("dist/ not found. Run `npm run build` first.");
    process.exit(1);
  }

  // firebase.json's catch-all rewrite serves spa-shell.html for URLs without a
  // static snapshot. Emit it from the raw Vite shell before the "/" snapshot
  // overwrites dist/index.html, minus the homepage canonical/robots tags so
  // unknown URLs don't claim to canonicalize to the homepage — the client-side
  // Seo component sets the correct meta per route.
  const shellHtml = readFileSync(path.join(dist, "index.html"), "utf8");
  const spaShellHtml = normalizeLoopbackAttributeUrls(shellHtml
    .replace(/[ \t]*<link\b[^>]*rel="canonical"[^>]*>\r?\n?/g, "")
    .replace(/[ \t]*<meta\b[^>]*name="robots"[^>]*>\r?\n?/g, "")
    .replace(/[ \t]*<meta\b[^>]*name="googlebot"[^>]*>\r?\n?/g, ""));
  assertNoLoopbackUrls(spaShellHtml, "spa-shell.html");
  writeFileSync(path.join(dist, "spa-shell.html"), spaShellHtml);

  const allRoutes = urlsFromSitemap();
  const routes = allRoutes;
  console.log(`Prerendering ${routes.length} routes...`);

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
    const html = await page.content();
    const out = outputPathFor(route);
    const serializedHtml = normalizeLoopbackAttributeUrls(pruneHeavyPreloads(html, route));
    assertNoLoopbackUrls(serializedHtml, route);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, serializedHtml);
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

  if (failures.length > 0) {
    console.error(
      failures.map((f) => `  ${f.route}: ${f.message}`).join("\n"),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
