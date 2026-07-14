const DESMOS_API_KEY =
  import.meta.env.VITE_DESMOS_API_KEY ?? "dcb31709b452b1cf9dc26972add0fda6";
const DESMOS_SRC = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_API_KEY}`;
const DESMOS_LOAD_ERROR = "Desmos failed to load";

export interface DesmosCalculator {
  destroy: () => void;
  resize: () => void;
  setExpression: (expr: DesmosExpressionState | DesmosTableState) => void;
  setMathBounds?: (bounds: { left: number; right: number; bottom: number; top: number }) => void;
  getState?: () => unknown;
  getExpressions?: () => Array<DesmosExpressionState | DesmosTableState>;
  setState?: (state: unknown, options?: { allowUndo?: boolean }) => void;
  observeEvent?: (eventName: string, callback: () => void) => void;
  unobserveEvent?: (eventName: string, callback: () => void) => void;
}

export interface DesmosExpressionState {
  id: string;
  type?: "expression";
  latex?: string;
  color?: string;
  label?: string;
  showLabel?: boolean;
  hidden?: boolean;
  sliderBounds?: {
    min: string;
    max: string;
    step: string;
  };
  playing?: boolean;
}

export interface DesmosTableState {
  id: string;
  type: "table";
  columns: Array<{
    latex: string;
    values: string[];
    color?: string;
  }>;
}

export interface DesmosApi {
  GraphingCalculator: (
    el: HTMLElement,
    options?: Record<string, unknown>,
  ) => DesmosCalculator;
}

export type DesmosWindow = Window & {
  Desmos?: DesmosApi;
};

let desmosLoadPromise: Promise<void> | null = null;

const hasDesmos = () => Boolean((window as DesmosWindow).Desmos);

const handleLoadFailure = (
  script: HTMLScriptElement,
  reject: (reason?: unknown) => void,
) => {
  script.remove();
  desmosLoadPromise = null;
  reject(new Error(DESMOS_LOAD_ERROR));
};

export const loadDesmos = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();
  if (hasDesmos()) {
    return Promise.resolve();
  }
  if (desmosLoadPromise) return desmosLoadPromise;

  desmosLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${DESMOS_SRC}"]`,
    );
    if (existing) {
      if (hasDesmos()) {
        resolve();
        return;
      }
      existing.addEventListener(
        "load",
        () => {
          if (hasDesmos()) {
            resolve();
            return;
          }
          handleLoadFailure(existing, reject);
        },
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => handleLoadFailure(existing, reject),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = DESMOS_SRC;
    script.async = true;
    script.onload = () => {
      if (hasDesmos()) {
        resolve();
        return;
      }
      handleLoadFailure(script, reject);
    };
    script.onerror = () => handleLoadFailure(script, reject);
    document.head.appendChild(script);
  });

  return desmosLoadPromise;
};
