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
const PORT = 4173;

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

  const routes = urlsFromSitemap();
  console.log(`Prerendering ${routes.length} routes...`);

  const server = serveStaticSpa();
  await new Promise((r) => server.listen(PORT, r));

  // Sandbox flags are gated behind PRERENDER_NO_SANDBOX so CI containers that
  // genuinely need them can opt in, while local/dev runs keep the sandbox on.
  const launchArgs = process.env.PRERENDER_NO_SANDBOX === "1"
    ? ["--no-sandbox", "--disable-setuid-sandbox"]
    : [];
  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
  });

  const concurrency = 6;
  let cursor = 0;
  let done = 0;
  let failed = 0;

  async function worker() {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    while (true) {
      const i = cursor++;
      if (i >= routes.length) break;
      const route = routes[i];
      try {
        await page.goto(`http://localhost:${PORT}${route}`, {
          waitUntil: "networkidle0",
          timeout: 30000,
        });
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const html = await page.content();
        const out = outputPathFor(route);
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, html);
        done++;
        if (done % 25 === 0) console.log(`  ${done}/${routes.length}`);
      } catch (err) {
        failed++;
        console.warn(`  fail ${route}: ${err.message}`);
      }
    }
    await page.close();
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  await browser.close();
  await new Promise((r) => server.close(r));

  console.log(`Prerendered ${done} routes (${failed} failed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
