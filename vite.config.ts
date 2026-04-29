import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import * as fs from "node:fs";
import path from "node:path";
import { componentTagger } from "lovable-tagger";

const SAT_IMAGE_ROUTE = "/images/SAT-Style-Questions/";
const SAT_IMAGE_SOURCE_DIR = path.resolve(__dirname, "public/images/SAT-Style Questions");

const getImageContentType = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  return "image/png";
};

const satImageAliasPlugin = (): Plugin => ({
  name: "sat-image-alias",
  configureServer(server) {
    server.middlewares.use(SAT_IMAGE_ROUTE, (req, res, next) => {
      const pathname = (req.url || "").split("?")[0] || "";
      let decodedPathname: string;
      try {
        decodedPathname = decodeURIComponent(pathname);
      } catch {
        next();
        return;
      }

      const filePath = path.resolve(SAT_IMAGE_SOURCE_DIR, decodedPathname.replace(/^\/+/, ""));
      if (!filePath.startsWith(`${SAT_IMAGE_SOURCE_DIR}${path.sep}`)) {
        next();
        return;
      }

      fs.stat(filePath, (error, stats) => {
        if (error || !stats.isFile()) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", getImageContentType(filePath));
        res.setHeader("Content-Length", String(stats.size));
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        fs.createReadStream(filePath).pipe(res);
      });
    });
  },
  closeBundle() {
    const distImagesDir = path.resolve(__dirname, "dist/images");
    const sourceDir = path.join(distImagesDir, "SAT-Style Questions");
    const aliasDir = path.join(distImagesDir, "SAT-Style-Questions");
    if (!fs.existsSync(sourceDir)) return;

    fs.rmSync(aliasDir, { recursive: true, force: true });
    fs.renameSync(sourceDir, aliasDir);
    fs.symlinkSync("SAT-Style-Questions", sourceDir, "dir");
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/data/unofficialQuestions.ts")) {
            return "bank-data-unofficial";
          }

          if (id.includes("/src/data/all_questions.ts")) {
            return "bank-data-past";
          }

          if (
            id.includes("/src/data/questions/math_past.json") ||
            id.includes("/src/data/questions/reading_past.json")
          ) {
            return "bank-data-past";
          }

          if (id.includes("/src/data/questionCategories.ts")) {
            return "bank-categories";
          }

          if (id.includes("/src/data/Modules/")) {
            return "module-data";
          }

          if (
            id.includes("/src/data/unofficialQuestionImageMap.ts") ||
            id.includes("/src/data/questionImageMap.ts") ||
            id.includes("/src/data/satImageManifest.ts") ||
            id.includes("/src/data/category_map.json")
          ) {
            return "bank-data-images";
          }

          if (
            id.includes("/src/data/vocabulary.ts") ||
            id.includes("/src/data/midFrequencyWords.ts")
          ) {
            return "vocab-data";
          }

          if (id.includes("/node_modules/firebase/")) {
            return "vendor-firebase";
          }

          if (id.includes("/node_modules/katex/")) {
            return "vendor-katex";
          }

          if (
            id.includes("/node_modules/recharts/") ||
            id.includes("/node_modules/d3-") ||
            id.includes("/node_modules/victory-vendor/")
          ) {
            return "vendor-recharts";
          }

          if (id.includes("/node_modules/@radix-ui/")) {
            return "vendor-radix";
          }

          if (id.includes("/node_modules/lucide-react/")) {
            return "vendor-icons";
          }

          if (
            id.includes("/node_modules/react-router") ||
            id.includes("/node_modules/@remix-run/")
          ) {
            return "vendor-router";
          }

          if (id.includes("/node_modules/@tanstack/")) {
            return "vendor-query";
          }

          if (id.includes("/node_modules/date-fns/")) {
            return "vendor-datefns";
          }

          if (id.includes("/node_modules/dompurify/")) {
            return "vendor-dompurify";
          }

          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          if (id.includes("/node_modules/")) {
            return "vendor";
          }
        },
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
  plugins: [satImageAliasPlugin(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
