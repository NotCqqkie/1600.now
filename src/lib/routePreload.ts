type RoutePreloader = (pathname: string) => Promise<unknown>;
type RouteTarget = string | { pathname?: string };

let routePreloader: RoutePreloader | null = null;
const preloads = new Map<string, Promise<unknown>>();

export const registerRoutePreloader = (preloader: RoutePreloader) => {
  routePreloader = preloader;
};

const targetPathname = (target: RouteTarget) => {
  if (typeof target === "string") {
    if (!target.startsWith("/") || target.startsWith("//")) return null;
    return target.split(/[?#]/, 1)[0] || "/";
  }

  const pathname = target.pathname;
  return pathname && pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : null;
};

export const preloadPathname = (pathname: string) => {
  if (!routePreloader) return Promise.resolve();

  const existing = preloads.get(pathname);
  if (existing) return existing;

  const preload = routePreloader(pathname).catch((error: unknown) => {
    preloads.delete(pathname);
    throw error;
  });
  preloads.set(pathname, preload);
  return preload;
};

export const preloadRouteIntent = (target: RouteTarget) => {
  const pathname = targetPathname(target);
  if (!pathname) return;
  void preloadPathname(pathname).catch(() => undefined);
};
