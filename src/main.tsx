import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  clearChunkRecoveryFlag,
  hasAttemptedChunkReload,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "./lib/chunkLoadRecovery";
import { reportError } from "./lib/reportError";

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    recoverFromChunkLoadError();
    return;
  }
  reportError(event.reason, { source: "unhandledrejection" });
});

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error ?? event.message)) {
    if (!hasAttemptedChunkReload()) recoverFromChunkLoadError();
    return;
  }
  reportError(event.error ?? event.message, { source: "window_error" });
});

window.addEventListener("load", clearChunkRecoveryFlag);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
