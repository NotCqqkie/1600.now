import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
