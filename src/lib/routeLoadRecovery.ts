const routeLoadErrorResetters = new Set<() => void>();

export const registerRouteLoadErrorReset = (reset: () => void) => {
  routeLoadErrorResetters.add(reset);
  return () => routeLoadErrorResetters.delete(reset);
};

export const resetRouteLoadErrors = () => {
  routeLoadErrorResetters.forEach((reset) => reset());
};
