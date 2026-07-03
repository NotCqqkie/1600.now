import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

// Some source modules (e.g. scoreReportParser) use Vite's `?url` import
// suffix, which Vitest's default resolver does not understand. Stub any
// `?url` import to an empty string so those modules can be imported in tests.
const stubUrlImports = (): Plugin => ({
  name: "stub-url-imports",
  resolveId(source) {
    if (source.endsWith("?url")) return `\0url-stub:${source}`;
    return null;
  },
  load(id) {
    if (id.startsWith("\0url-stub:")) return `export default "";`;
    return null;
  },
});

export default defineConfig({
  plugins: [stubUrlImports()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
