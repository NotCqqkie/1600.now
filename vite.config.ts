import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import * as fs from "node:fs";
import path from "node:path";

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
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: ["host.docker.internal", "localhost"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // Manual chunks are restricted to pure data files (no React imports).
        // Splitting node_modules into named vendor chunks caused a cross-chunk
        // init order race where chunks imported React.forwardRef /
        // React.createContext before the React chunk had executed. Letting
        // Rollup auto-chunk node_modules avoids the race.
        manualChunks(id) {
          if (id.includes("/src/lib/generated/bankMetadata.generated.ts")) {
            return "bank-data-metadata";
          }

          if (id.includes("/src/lib/generated/bankTotals.generated.ts")) {
            return "bank-data-totals";
          }

          if (id.includes("/src/lib/generated/questionSimilarity.generated.ts")) {
            return "bank-data-similarity";
          }

          if (id.includes("/src/lib/generated/hiddenBankQuestions.generated.ts")) {
            return "bank-data-hidden";
          }

          if (id.includes("/src/data/pastQuestionDifficulty.ts")) {
            return "bank-data-past-difficulty";
          }

          if (id.includes("/src/data/unofficialQuestions.ts")) {
            return "bank-data-unofficial";
          }

          if (id.includes("/src/data/questions/math_past.json")) {
            return "bank-data-past-math";
          }

          if (id.includes("/src/data/questions/reading_past.json")) {
            return "bank-data-past-reading";
          }

          if (id.includes("/src/data/questionCategories.ts")) {
            return "bank-categories";
          }

          if (id.includes("/src/data/modules/")) {
            return "module-data";
          }

          if (
            id.includes("/src/data/unofficialQuestionImageMap.ts") ||
            id.includes("/src/data/questionImageMap.ts") ||
            id.includes("/src/data/satImageManifest.ts")
          ) {
            return "bank-data-images";
          }

          if (id.includes("/src/data/vocabulary.ts")) {
            return "vocab-data";
          }
        },
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
  plugins: [satImageAliasPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
