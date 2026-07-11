import * as React from "react";

export const MOBILE_BREAKPOINT = 768;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
const getIsMobile = (): boolean => window.innerWidth < MOBILE_BREAKPOINT;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? getIsMobile() : false,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = () => {
      setIsMobile(getIsMobile());
    };
    mql.addEventListener("change", onChange);
    setIsMobile(getIsMobile());
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
