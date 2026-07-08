const CHUNK_RELOAD_KEY = "chunk_reload_attempted";

export const isChunkLoadError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = message.toLowerCase();
  return (
    normalized.includes("dynamically imported module") ||
    normalized.includes("expected a javascript-or-wasm module script") ||
    normalized.includes("strict mime type checking") ||
    normalized.includes("dispatcher.usecontext") ||
    (
      normalized.includes("usecontext") &&
      (
        normalized.includes("dispatcher is null") ||
        normalized.includes("cannot read properties of null") ||
        normalized.includes("can't access property")
      )
    )
  );
};

export const hasAttemptedChunkReload = (): boolean =>
  sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";

export const recoverFromChunkLoadError = (): void => {
  if (hasAttemptedChunkReload()) {
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString());
  window.location.replace(url.toString());
};

export const clearChunkRecoveryFlag = (): void => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
};
