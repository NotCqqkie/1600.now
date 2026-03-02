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
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("error loading dynamically imported module")
  );
};

export const recoverFromChunkLoadError = (): void => {
  const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
  if (alreadyReloaded) {
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
