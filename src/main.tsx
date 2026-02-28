import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const CHUNK_RELOAD_KEY = "chunk_reload_attempted";

const isChunkLoadError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = message.toLowerCase();
  return (
    normalized.includes("dynamically imported module") ||
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("error loading dynamically imported module")
  );
};

window.addEventListener("unhandledrejection", (event) => {
  if (!isChunkLoadError(event.reason)) return;

  const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
  if (alreadyReloaded) return;

  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
});

window.addEventListener("load", () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
