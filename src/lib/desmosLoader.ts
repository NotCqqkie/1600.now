const DESMOS_SRC =
  "https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";

let desmosLoadPromise: Promise<void> | null = null;

export const loadDesmos = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as typeof window & { Desmos?: unknown }).Desmos) {
    return Promise.resolve();
  }
  if (desmosLoadPromise) return desmosLoadPromise;

  desmosLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${DESMOS_SRC}"]`,
    );
    if (existing) {
      if ((window as typeof window & { Desmos?: unknown }).Desmos) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => {
          desmosLoadPromise = null;
          reject(new Error("Desmos failed to load"));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = DESMOS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      desmosLoadPromise = null;
      reject(new Error("Desmos failed to load"));
    };
    document.head.appendChild(script);
  });

  return desmosLoadPromise;
};
