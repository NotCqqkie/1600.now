import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Settings,
  SpellCheck,
  Sun,
  Target,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { PreloadLink } from "@/components/PreloadLink";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { applyTheme, useThemeMode } from "@/lib/theme";
import { preloadRouteIntent } from "@/lib/routePreload";

const ONBOARDING_REPLAY_REQUEST_KEY = "onboarding-replay-requested";
const ONBOARDING_REPLAY_RETURN_PATH_KEY = "onboarding-replay-return-path";
const DESKTOP_SIDEBAR_EXPANDED_WIDTH = 224;
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = 72;
const DESKTOP_SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const SIDEBAR_COLLAPSE_STORAGE_PREFIX = "app-sidebar-collapsed";

const sidebarCollapseStorageKey = (uid: string | null | undefined) =>
  `${SIDEBAR_COLLAPSE_STORAGE_PREFIX}:${uid ?? "anon"}`;

const readSidebarCollapsedPreference = (uid: string | null | undefined) => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(sidebarCollapseStorageKey(uid));
  if (value === "collapsed") return true;
  if (value === "expanded") return false;
  return null;
};

const writeSidebarCollapsedPreference = (uid: string | null | undefined, collapsed: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sidebarCollapseStorageKey(uid), collapsed ? "collapsed" : "expanded");
};

type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  tourId?: string;
};

const primaryItems: SidebarItem[] = [
  { label: "Question Bank", href: "/bank", icon: BookOpen, match: (pathname: string) => pathname.startsWith("/bank"), tourId: "nav-bank" },
  { label: "Practice Tests", href: "/modules", icon: GraduationCap, match: (pathname: string) => pathname.startsWith("/modules"), tourId: "nav-modules" },
  { label: "100 Hard Math", href: "/hard", icon: Target, match: (pathname: string) => pathname.startsWith("/hard"), tourId: "nav-hard" },
  { label: "Vocabulary", href: "/vocab", icon: SpellCheck, match: (pathname: string) => pathname.startsWith("/vocab"), tourId: "nav-vocab" },
  { label: "My Practice Sets", href: "/my-practice-sets", icon: BookOpenCheck, match: (pathname: string) => pathname.startsWith("/my-practice-sets") },
  { label: "Score Calculator", href: "/score-calculator", icon: Calculator, match: (pathname: string) => pathname.startsWith("/score-calculator"), tourId: "nav-calc" },
  { label: "Test Results", href: "/test-results", icon: ClipboardList, match: (pathname: string) => pathname.startsWith("/test-results"), tourId: "nav-test-results" },
];

const mobileItems = primaryItems.slice(0, 5);
const mobileLabelByHref: Record<string, string> = {
  "/bank": "Question Bank",
  "/modules": "Practice Tests",
  "/hard": "100 Hard Math",
  "/vocab": "Vocab",
  "/my-practice-sets": "Practice Sets",
};

const secondaryItems: SidebarItem[] = [
  { label: "Statistics", href: "/analysis", icon: BarChart3, match: (pathname: string) => pathname.startsWith("/analysis"), tourId: "nav-stats" },
  { label: "Settings", href: "/profile", icon: Settings, match: (pathname: string) => pathname.startsWith("/profile"), tourId: "nav-settings" },
];

type SidebarNavSection = {
  label?: string;
  items: SidebarItem[];
};

const sidebarSections: SidebarNavSection[] = [
  { items: primaryItems },
  { label: "Account", items: secondaryItems },
];

const SidebarLinkContent = ({
  label,
  icon: Icon,
  showLabel,
}: {
  label: string;
  icon: LucideIcon;
  showLabel: boolean;
}) => {
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4 shrink-0" />
      </span>
      <span
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-200 ease-out",
          showLabel ? "ml-0 max-w-[10rem] opacity-100 translate-x-0" : "ml-0 max-w-0 opacity-0 -translate-x-1 text-transparent",
        )}
      >
        {label}
      </span>
    </>
  );
};

const SidebarNavRow = ({
  item,
  active,
  showLabel,
}: {
  item: SidebarItem;
  active: boolean;
  showLabel: boolean;
}) => {
  const className = cn(
    "flex items-center overflow-hidden rounded-lg font-sans text-[13px] font-semibold tracking-[-0.005em] transition-[width,height,padding] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    showLabel ? "h-10 w-full pr-3" : "h-10 w-10 pr-0",
    active
      ? "bg-ink-fixed text-white shadow-sm dark:bg-white dark:text-ink-fixed"
      : "text-ink-mid hover:bg-ds-accent/25 hover:text-ink dark:hover:bg-white/10",
  );

  return (
    <PreloadLink
      to={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      title={item.label}
      data-tour={item.tourId}
      className={className}
    >
      <SidebarLinkContent label={item.label} icon={item.icon} showLabel={showLabel} />
    </PreloadLink>
  );
};

const SidebarNavSectionLabel = ({ label, showLabel }: { label: string; showLabel: boolean }) => (
  <div className="mt-5 h-4 overflow-hidden px-3">
    <div className="relative h-4">
      <div
        aria-hidden={!showLabel}
        className={cn(
          "ds-caption absolute left-0 top-1/2 -translate-y-1/2 transition-opacity duration-200 ease-out",
          showLabel ? "opacity-100" : "opacity-0 text-transparent",
        )}
      >
        {label}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 block h-px w-6 -translate-y-1/2 rounded-full bg-border/90 transition-opacity duration-200 ease-out",
          showLabel ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  </div>
);

const SidebarNavContent = ({
  sections,
  pathname,
  showLabel,
}: {
  sections: SidebarNavSection[];
  pathname: string;
  showLabel: boolean;
}) => (
  <>
    {sections.map((section, sectionIndex) => (
      <div key={section.label ?? `section-${sectionIndex}`}>
        {section.label && (
          <SidebarNavSectionLabel label={section.label} showLabel={showLabel} />
        )}
        <div className={cn(section.label ? "mt-2 space-y-1" : "space-y-1")}>
          {section.items.map((item) => (
            <SidebarNavRow
              key={item.href}
              item={item}
              active={item.match(pathname)}
              showLabel={showLabel}
            />
          ))}
        </div>
      </div>
    ))}
  </>
);

const FooterActionButton = ({
  label,
  icon: Icon,
  renderIcon,
  expanded,
  onClick,
  variant = "ghost",
  className,
  title,
  tourId,
  preloadHref,
}: {
  label: string;
  icon: LucideIcon;
  renderIcon?: (className: string) => ReactNode;
  expanded: boolean;
  onClick: () => void;
  variant?: "ghost" | "outline";
  className?: string;
  title?: string;
  tourId?: string;
  preloadHref?: string;
}) => {
  const preload = useCallback(() => {
    if (preloadHref) preloadRouteIntent(preloadHref);
  }, [preloadHref]);

  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={preload}
      onPointerDown={preload}
      onPointerEnter={preload}
      onTouchStart={preload}
      aria-label={label}
      title={title ?? label}
      data-tour={tourId}
      className={cn(
        "flex items-center overflow-hidden rounded-lg font-sans text-[13px] font-medium text-ink transition-[width,height,padding] duration-200 ease-out",
        expanded ? "h-10 w-full pr-3" : "h-10 w-10 pr-0",
        variant === "outline"
          ? "border border-ds-line hover:bg-ds-accent/25"
          : "hover:bg-ds-accent/25",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        {renderIcon ? renderIcon("h-4 w-4 shrink-0") : <Icon className="h-4 w-4 shrink-0" />}
      </span>
      <span
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-200 ease-out",
          expanded ? "ml-0 max-w-[10rem] opacity-100 translate-x-0" : "ml-0 max-w-0 opacity-0 -translate-x-1 text-transparent",
        )}
      >
        {label}
      </span>
    </button>
  );
};

const ThemeToggleIcon = ({ isDark, className }: { isDark: boolean; className: string }) => (
  <span className={cn("pointer-events-none relative inline-flex", className)} aria-hidden="true">
    <Moon
      className={cn(
        "absolute inset-0 h-full w-full transition-[opacity,transform] duration-200 ease-out",
        isDark ? "scale-75 rotate-45 opacity-0" : "scale-100 rotate-0 opacity-100",
      )}
    />
    <Sun
      className={cn(
        "absolute inset-0 h-full w-full transition-[opacity,transform] duration-200 ease-out",
        isDark ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-45 opacity-0",
      )}
    />
  </span>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isEmbed =
    typeof window !== "undefined" &&
    window.self !== window.top &&
    new URLSearchParams(location.search).get("embed") === "1";
  const { user, signOut } = useAuth();
  const isDark = useThemeMode();
  const isMobile = useIsMobile();
  const userId = user?.uid ?? null;
  const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsedState] = useState(() =>
    readSidebarCollapsedPreference(null) ?? false,
  );
  const [isDesktopSidebarVisuallyCollapsed, setIsDesktopSidebarVisuallyCollapsed] = useState(() =>
    readSidebarCollapsedPreference(null) ?? false,
  );
  const [sidebarWidth, setSidebarWidth] = useState(DESKTOP_SIDEBAR_EXPANDED_WIDTH);
  const lastIsMobileRef = useRef<boolean | null>(null);
  const loadedSidebarPreferenceKeyRef = useRef<string | null>(null);
  const collapseAnimationFrameRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastIsMobileRef.current === null) {
      lastIsMobileRef.current = isMobile;
      return;
    }
    if (lastIsMobileRef.current !== isMobile) {
      lastIsMobileRef.current = isMobile;
      setIsSidebarHidden(isMobile);
    }
  }, [isMobile]);
  useEffect(() => {
    if (isMobile) setIsSidebarHidden(true);
  }, [location.pathname, isMobile]);
  useEffect(() => {
    const key = sidebarCollapseStorageKey(userId);
    if (loadedSidebarPreferenceKeyRef.current === key) return;

    loadedSidebarPreferenceKeyRef.current = key;
    const scopedPreference = readSidebarCollapsedPreference(userId);
    if (scopedPreference !== null) {
      setIsDesktopSidebarCollapsedState(scopedPreference);
      setIsDesktopSidebarVisuallyCollapsed(scopedPreference);
      return;
    }

    const anonymousPreference = userId ? readSidebarCollapsedPreference(null) : null;
    if (anonymousPreference !== null) {
      writeSidebarCollapsedPreference(userId, anonymousPreference);
      setIsDesktopSidebarCollapsedState(anonymousPreference);
      setIsDesktopSidebarVisuallyCollapsed(anonymousPreference);
      return;
    }

    writeSidebarCollapsedPreference(userId, isDesktopSidebarCollapsed);
  }, [isDesktopSidebarCollapsed, userId]);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const showExpandedContent = isMobile || !isDesktopSidebarVisuallyCollapsed;
  const desktopSidebarWidth = isDesktopSidebarVisuallyCollapsed
    ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH
    : sidebarWidth;
  const sidebarLayoutStyle = {
    "--app-sidebar-width": `${desktopSidebarWidth}px`,
    "--app-sidebar-padding": `${desktopSidebarWidth}px`,
    transitionTimingFunction: DESKTOP_SIDEBAR_EASING,
  } as CSSProperties;

  const setDesktopSidebarCollapsed = useCallback((collapsed: boolean, animate = true) => {
    if (!collapsed) {
      setSidebarWidth(DESKTOP_SIDEBAR_EXPANDED_WIDTH);
    }
    setIsDesktopSidebarCollapsedState(collapsed);
    writeSidebarCollapsedPreference(userId, collapsed);
    if (collapseAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(collapseAnimationFrameRef.current);
      collapseAnimationFrameRef.current = null;
    }
    if (!animate || typeof window === "undefined") {
      setIsDesktopSidebarVisuallyCollapsed(collapsed);
      return;
    }
    setIsDesktopSidebarVisuallyCollapsed(!collapsed);
    collapseAnimationFrameRef.current = window.requestAnimationFrame(() => {
      collapseAnimationFrameRef.current = null;
      setIsDesktopSidebarVisuallyCollapsed(collapsed);
    });
  }, [userId]);

  useEffect(() => () => {
    if (collapseAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(collapseAnimationFrameRef.current);
    }
  }, []);

  const handleSignOut = async () => {
    setIsLogoutDialogOpen(false);
    await signOut();
    navigate("/");
  };

  const handleSidebarToggle = () => {
    if (isMobile) {
      setIsSidebarHidden((hidden) => !hidden);
      return;
    }

    setDesktopSidebarCollapsed(!isDesktopSidebarCollapsed);
  };

  const handleThemeToggle = () => {
    applyTheme(!isDark);
  };

  const handleReplayTour = () => {
    sessionStorage.setItem(
      ONBOARDING_REPLAY_RETURN_PATH_KEY,
      `${location.pathname}${location.search}${location.hash}`,
    );
    sessionStorage.setItem(ONBOARDING_REPLAY_REQUEST_KEY, "1");
    window.dispatchEvent(new CustomEvent("onboarding:replay"));
  };

  if (isEmbed) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen">
      {!isSidebarHidden && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          aria-label="Hide sidebar overlay"
          onClick={() => setIsSidebarHidden(true)}
        />
      )}

      <aside
        data-tour="sidebar"
        data-collapsed={isDesktopSidebarVisuallyCollapsed ? "true" : "false"}
        style={sidebarLayoutStyle}
        className={cn(
          "app-sidebar-shell sat-resize-transition fixed inset-y-0 left-0 z-40 flex w-72 flex-col overscroll-x-none border-r border-border/60 bg-card/95 py-3 backdrop-blur will-change-transform motion-reduce:transition-none lg:px-4",
          isSidebarHidden
            ? "-translate-x-full px-4 lg:translate-x-0"
            : "translate-x-0 px-4",
        )}
      >
        <button
          type="button"
          className={cn(
            "absolute top-3 z-50 hidden items-center justify-center text-muted-foreground hover:text-foreground lg:inline-flex",
            isDesktopSidebarVisuallyCollapsed
              ? "left-full h-8 w-6 rounded-r-lg border border-l-0 border-border/70 bg-card/95 shadow-sm"
              : "right-4 h-9 w-9 rounded-lg",
          )}
          onClick={handleSidebarToggle}
          aria-label={isDesktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isDesktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isDesktopSidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        <div className="flex h-9 items-start overflow-hidden">
          <BrandLogo
            variant="adaptive"
            collapsed={!showExpandedContent}
            className="h-9 w-[148px]"
            imageClassName="origin-left scale-[1.30] object-left -translate-x-[5px]"
          />
        </div>

        <div className="mt-3 -mx-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none px-2">
          <SidebarNavContent
            sections={sidebarSections}
            pathname={location.pathname}
            showLabel={showExpandedContent}
          />
        </div>

        <div className="-mx-2 overflow-x-hidden border-t border-border/70 px-2 pt-2.5">
          <div className="space-y-1.5 pb-1">
            <FooterActionButton
              label="Replay tour"
              icon={HelpCircle}
              expanded={showExpandedContent}
              onClick={handleReplayTour}
              variant="outline"
              title="Replay the intro tour"
              tourId="tour-replay"
            />
            <FooterActionButton
              label={isDark ? "Light" : "Dark"}
              icon={isDark ? Sun : Moon}
              renderIcon={(className) => <ThemeToggleIcon isDark={isDark} className={className} />}
              expanded={showExpandedContent}
              onClick={handleThemeToggle}
              variant="outline"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              tourId="theme-toggle"
            />

            {user ? (
              <FooterActionButton
                label="Log out"
                icon={LogOut}
                expanded={showExpandedContent}
                onClick={() => setIsLogoutDialogOpen(true)}
                variant="outline"
                className="text-red-600 hover:text-red-700"
                title={user.email ? `Log out (${user.email})` : "Log out"}
              />
            ) : (
              <>
                <FooterActionButton
                  label="Log In"
                  icon={LogIn}
                  expanded={showExpandedContent}
                  onClick={() => navigate("/login")}
                  preloadHref="/login"
                  variant="outline"
                  className="text-foreground hover:text-foreground"
                />
                <FooterActionButton
                  label="Sign Up"
                  icon={UserPlus}
                  expanded={showExpandedContent}
                  onClick={() => navigate("/signup")}
                  preloadHref="/signup"
                  className="!bg-ds-accent !font-semibold !text-ink-fixed shadow-sm hover:!bg-ds-accent/85 hover:!text-ink-fixed"
                />
              </>
            )}
          </div>
        </div>
      </aside>

      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "fixed left-3 top-3 z-50 h-11 w-11 rounded-xl bg-card/95 shadow-md backdrop-blur lg:hidden",
          isSidebarHidden ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setIsSidebarHidden(false)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div
        data-collapsed={isDesktopSidebarVisuallyCollapsed ? "true" : "false"}
        style={sidebarLayoutStyle}
        className={cn(
          "app-sidebar-content sat-resize-transition min-h-screen pt-14 motion-reduce:transition-none lg:pt-0",
        )}
      >
        <nav
          aria-label="Primary mobile navigation"
          className="mx-auto mb-2 grid max-w-2xl grid-cols-5 gap-1 px-3 lg:hidden"
        >
          {mobileItems.map((item) => {
            const active = item.match(location.pathname);
            const Icon = item.icon;
            const mobileLabel = mobileLabelByHref[item.href];

            return (
              <PreloadLink
                key={item.label}
                to={item.href}
                aria-label={item.label}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card/80 px-0.5 py-2 text-[10px] font-medium shadow-sm",
                  active ? "border-primary/40 bg-ds-accent text-ink-fixed" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex min-h-6 w-full items-center justify-center text-center leading-tight">{mobileLabel}</span>
              </PreloadLink>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
};
