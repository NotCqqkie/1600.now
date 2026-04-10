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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/data/unofficialQuestions.ts")) {
            return "bank-data-unofficial";
          }

          if (id.includes("/src/data/all_questions.ts")) {
            return "bank-data-past";
          }

          if (id.includes("/src/data/official_questions.ts")) {
            return "bank-data-official";
          }

          if (id.includes("/src/data/questionCategories.ts")) {
            return "bank-categories";
          }

          if (id.includes("/node_modules/firebase/")) {
            return "vendor-firebase";
          }

          if (id.includes("/node_modules/katex/")) {
            return "vendor-katex";
          }

          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "vendor-react";
          }
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
