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
import { preloadPathname } from "./lib/routePreload";

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

const renderApp = () =>
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );

void Promise.race([
  preloadPathname(window.location.pathname).catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).then(renderApp);
