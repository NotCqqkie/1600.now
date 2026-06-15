const AUTH_PATHS = new Set(["/login", "/signup", "/verify-email"]);

export const AUTH_RETURN_KEY = "authReturnTo";

const isSafeReturnPath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");

export const isAuthPath = (pathname: string): boolean => AUTH_PATHS.has(pathname);

export const getAuthReturnTo = (): string => {
  try {
    const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    if (
      stored &&
      isSafeReturnPath(stored) &&
      !isAuthPath(stored.split("?")[0])
    ) {
      return stored;
    }
  } catch {
    return "/";
  }
  return "/";
};

export const getPostAuthReturnTo = (): string => {
  const returnTo = getAuthReturnTo();
  return returnTo.split("?")[0] === "/" ? "/bank" : returnTo;
};
