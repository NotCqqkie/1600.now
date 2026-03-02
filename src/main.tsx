import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  clearChunkRecoveryFlag,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "./lib/chunkLoadRecovery";

window.addEventListener("unhandledrejection", (event) => {
  if (!isChunkLoadError(event.reason)) return;
  recoverFromChunkLoadError();
});

window.addEventListener("load", () => {
  clearChunkRecoveryFlag();
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
