export const shouldUseSidebarLayout = (sidebarRequested: boolean, isMobile: boolean) =>
  sidebarRequested && !isMobile;
