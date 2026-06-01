#!/usr/bin/env node
// Prerenders every URL in public/sitemap.xml into dist/{route}/index.html
// so Googlebot and social-preview crawlers see content without running JS.
//
// Flow: serve dist/ via a local SPA-fallback HTTP server, visit each URL with
// puppeteer, snapshot the fully-rendered HTML, write it under the matching path.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const PREFERRED_PORT = Number(process.env.PRERENDER_PORT ?? 4173);
const PRERENDER_CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY ?? 4);
const PRERENDER_RETRY_CONCURRENCY = Number(process.env.PRERENDER_RETRY_CONCURRENCY ?? 1);
const PRERENDER_ATTEMPTS = Number(process.env.PRERENDER_ATTEMPTS ?? 3);

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
      let filePath = path.join(dist, urlPath);
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
        server.listen(port);
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
  // sitemap.xml is a sitemap index whose <loc> entries point at child
  // sitemaps. Walk one level deep and aggregate every page URL found.
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
  const clean = route === "/" ? "/index.html" : `${route.replace(/\/$/, "")}/index.html`;
  return path.join(dist, clean);
}

async function main() {
  if (!existsSync(dist)) {
    console.error("dist/ not found. Run `npm run build` first.");
    process.exit(1);
  }

  const allRoutes = urlsFromSitemap();
  const routes = allRoutes;
  console.log(`Prerendering ${routes.length} routes...`);

  const { server, port } = await listenServer();

  // Sandbox flags are gated behind PRERENDER_NO_SANDBOX so CI containers that
  // genuinely need them can opt in, while local/dev runs keep the sandbox on.
  const launchArgs = process.env.PRERENDER_NO_SANDBOX === "1"
    ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--single-process"]
    : [];
  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
    protocolTimeout: 180_000,
  });

  let done = 0;

  async function renderRoute(page, route) {
    await page.goto(`http://localhost:${port}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root");
        if (!root) return false;
        if (root.querySelector(".animate-spin")) return false;
        const text = root.textContent?.trim() ?? "";
        return text.length > 80 && document.title.trim().length > 0;
      },
      { timeout: 30000, polling: 100 },
    );
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const html = await page.content();
    const out = outputPathFor(route);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, html);
  }

  async function runBatch(batchRoutes, concurrency, attempt) {
    let cursor = 0;
    const failures = [];

    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= batchRoutes.length) break;
        const route = batchRoutes[i];
        let page = null;
        try {
          page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 900 });
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
      Array.from({ length: Math.min(concurrency, batchRoutes.length) }, () => worker()),
    );

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

  await browser.close();
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
