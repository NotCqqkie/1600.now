import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Settings,
  SpellCheck,
  SunMoon,
  Target,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
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

const ONBOARDING_REPLAY_REQUEST_KEY = "onboarding-replay-requested";
const DESKTOP_SIDEBAR_DEFAULT_WIDTH = 256;
const DESKTOP_SIDEBAR_MIN_WIDTH = 224;
const DESKTOP_SIDEBAR_MAX_WIDTH = 320;
const DESKTOP_SIDEBAR_DISMISS_THRESHOLD = 96;
const DESKTOP_SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  tourId?: string;
};

const primaryItems: SidebarItem[] = [
  { label: "Question Bank", href: "/bank", icon: BookOpen, match: (pathname: string) => pathname.startsWith("/bank"), tourId: "nav-bank" },
  { label: "100 Hard Math", href: "/hard", icon: Target, match: (pathname: string) => pathname.startsWith("/hard"), tourId: "nav-hard" },
  { label: "Practice Tests", href: "/modules", icon: GraduationCap, match: (pathname: string) => pathname.startsWith("/modules"), tourId: "nav-modules" },
  { label: "Score Calculator", href: "/score-calculator", icon: Calculator, match: (pathname: string) => pathname.startsWith("/score-calculator"), tourId: "nav-calc" },
  { label: "Vocabulary", href: "/vocab", icon: SpellCheck, match: (pathname: string) => pathname.startsWith("/vocab"), tourId: "nav-vocab" },
  { label: "My Practice Sets", href: "/my-practice-sets", icon: BookOpenCheck, match: (pathname: string) => pathname.startsWith("/my-practice-sets") },
  { label: "Test Results", href: "/test-results", icon: ClipboardList, match: (pathname: string) => pathname.startsWith("/test-results"), tourId: "nav-test-results" },
];

const mobileItems = primaryItems.slice(0, 5);
const mobileLabelByHref: Record<string, string> = {
  "/bank": "Bank",
  "/hard": "Hard",
  "/modules": "Tests",
  "/score-calculator": "Score",
  "/vocab": "Vocab",
};

const secondaryItems: SidebarItem[] = [
  { label: "Settings", href: "/profile", icon: Settings, match: (pathname: string) => pathname.startsWith("/profile"), tourId: "nav-settings" },
  { label: "Statistics", href: "/analysis", icon: BarChart3, match: (pathname: string) => pathname.startsWith("/analysis"), tourId: "nav-stats" },
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
          "min-w-0 overflow-hidden whitespace-nowrap",
          showLabel ? "ml-0 max-w-[10rem] opacity-100 translate-x-0" : "ml-0 max-w-0 opacity-0 -translate-x-1",
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
    "flex h-10 items-center overflow-hidden rounded-lg font-sans text-[13px] font-semibold tracking-[-0.005em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    showLabel ? "w-full pr-3" : "w-10 pr-0",
    active
      ? "bg-ink-fixed text-white shadow-sm dark:bg-white dark:text-ink-fixed"
      : "text-ink-mid hover:bg-ds-accent/25 hover:text-ink dark:hover:bg-white/10",
  );

  return (
    <Link
      to={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      title={item.label}
      data-tour={item.tourId}
      className={className}
    >
      <SidebarLinkContent label={item.label} icon={item.icon} showLabel={showLabel} />
    </Link>
  );
};

const SidebarNavSectionLabel = ({ label, showLabel }: { label: string; showLabel: boolean }) => (
  <div className="mt-5 h-4 overflow-hidden px-3">
    <div className="relative h-4">
      <div
        aria-hidden={!showLabel}
        className={cn(
          "ds-caption absolute left-0 top-1/2 -translate-y-1/2",
          showLabel ? "opacity-100" : "opacity-0",
        )}
      >
        {label}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 block h-px w-6 -translate-y-1/2 rounded-full bg-border/90",
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
  expanded,
  onClick,
  variant = "ghost",
  className,
  title,
  tourId,
}: {
  label: string;
  icon: LucideIcon;
  expanded: boolean;
  onClick: () => void;
  variant?: "ghost" | "outline";
  className?: string;
  title?: string;
  tourId?: string;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      data-tour={tourId}
      className={cn(
        "flex h-10 items-center overflow-hidden rounded-lg font-sans text-[13px] font-medium text-ink",
        expanded ? "w-full pr-3" : "w-10 pr-0",
        variant === "outline"
          ? "border border-ds-line hover:bg-ds-accent/25"
          : "hover:bg-ds-accent/25",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4 shrink-0" />
      </span>
      <span
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap",
          expanded ? "ml-0 max-w-[10rem] opacity-100 translate-x-0" : "ml-0 max-w-0 opacity-0 -translate-x-1",
        )}
      >
        {label}
      </span>
    </button>
  );
};

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
  const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  const [sidebarWidth, setSidebarWidth] = useState(DESKTOP_SIDEBAR_DEFAULT_WIDTH);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const sidebarWidthBeforeDragRef = useRef(DESKTOP_SIDEBAR_DEFAULT_WIDTH);
  const sidebarElementRef = useRef<HTMLElement | null>(null);
  const contentElementRef = useRef<HTMLDivElement | null>(null);
  const lastIsMobileRef = useRef<boolean | null>(null);
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
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const showExpandedContent = !isSidebarHidden;
  const sidebarLayoutStyle = {
    "--app-sidebar-width": `${sidebarWidth}px`,
    "--app-sidebar-padding": isSidebarHidden ? "0px" : `${sidebarWidth}px`,
    transitionTimingFunction: DESKTOP_SIDEBAR_EASING,
  } as CSSProperties;

  useEffect(() => {
    if (!isSidebarDragging) return;

    document.body.classList.add("noselect", "col-resize-active");
    let dismissedDuringDrag = false;
    let latestWidth = sidebarWidth;
    let latestClientX: number | null = null;
    let frameId: number | null = null;

    const applySidebarWidth = (width: number) => {
      latestWidth = width;
      const widthValue = `${width}px`;
      sidebarElementRef.current?.style.setProperty("--app-sidebar-width", widthValue);
      sidebarElementRef.current?.style.setProperty("--app-sidebar-padding", widthValue);
      contentElementRef.current?.style.setProperty("--app-sidebar-width", widthValue);
      contentElementRef.current?.style.setProperty("--app-sidebar-padding", widthValue);
    };

    const cancelPendingFrame = () => {
      if (frameId === null) return;
      window.cancelAnimationFrame(frameId);
      frameId = null;
    };

    const dismissFromDrag = () => {
      if (dismissedDuringDrag) return;
      dismissedDuringDrag = true;
      cancelPendingFrame();
      applySidebarWidth(DESKTOP_SIDEBAR_MIN_WIDTH);
      setIsSidebarDragging(false);
      document.body.classList.remove("noselect", "col-resize-active");
      setIsSidebarHidden(true);
      window.setTimeout(() => {
        setSidebarWidth(sidebarWidthBeforeDragRef.current);
      }, 200);
    };

    const applyClientX = (clientX: number) => {
      if (clientX <= DESKTOP_SIDEBAR_DISMISS_THRESHOLD) {
        dismissFromDrag();
        return;
      }

      applySidebarWidth(Math.max(
        DESKTOP_SIDEBAR_MIN_WIDTH,
        Math.min(DESKTOP_SIDEBAR_MAX_WIDTH, clientX),
      ));
    };

    const updateFromClientX = (clientX: number) => {
      latestClientX = clientX;
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (latestClientX === null || dismissedDuringDrag) return;
        applyClientX(latestClientX);
      });
    };

    const stopDragging = () => {
      if (dismissedDuringDrag) return;
      cancelPendingFrame();
      if (latestClientX !== null) {
        applyClientX(latestClientX);
      }
      if (dismissedDuringDrag) return;
      setIsSidebarDragging(false);
      setSidebarWidth(latestWidth);
      document.body.classList.remove("noselect", "col-resize-active");
    };

    const handleMouseMove = (event: MouseEvent) => updateFromClientX(event.clientX);
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 0) return;
      event.preventDefault();
      updateFromClientX(event.touches[0].clientX);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopDragging);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", stopDragging);
    document.addEventListener("touchcancel", stopDragging);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopDragging);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", stopDragging);
      document.removeEventListener("touchcancel", stopDragging);
      cancelPendingFrame();
      document.body.classList.remove("noselect", "col-resize-active");
    };
  }, [isSidebarDragging, sidebarWidth]);

  const handleSignOut = async () => {
    setIsLogoutDialogOpen(false);
    await signOut();
    navigate("/");
  };

  const handleThemeToggle = () => {
    applyTheme(!isDark);
  };

  const handleReplayTour = () => {
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
        ref={sidebarElementRef}
        data-tour="sidebar"
        style={sidebarLayoutStyle}
        className={cn(
          "sat-resize-transition fixed inset-y-0 left-0 z-40 flex w-72 flex-col overscroll-x-none border-r border-border/60 bg-card/95 py-3 backdrop-blur transition-transform duration-200 will-change-transform motion-reduce:transition-none lg:w-[var(--app-sidebar-width)] lg:px-4",
          isSidebarHidden
            ? "-translate-x-full px-4"
            : "translate-x-0 px-4",
          isSidebarDragging && "duration-0",
        )}
      >
        <button
          type="button"
          className="absolute right-4 top-3 z-50 hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground lg:inline-flex"
          onClick={() => setIsSidebarHidden((hidden) => !hidden)}
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {!isSidebarHidden && (
          <button
            type="button"
            aria-label="Resize or hide sidebar"
            title="Drag to resize or hide sidebar"
            className={cn(
              "group absolute inset-y-0 right-[-6px] z-50 hidden w-3 cursor-col-resize touch-none items-center justify-center lg:flex",
              isSidebarDragging && "pointer-events-none",
            )}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              sidebarWidthBeforeDragRef.current = sidebarWidth;
              setIsSidebarDragging(true);
            }}
            onTouchStart={(event) => {
              if (event.touches.length === 0) return;
              event.preventDefault();
              sidebarWidthBeforeDragRef.current = sidebarWidth;
              setIsSidebarDragging(true);
            }}
          >
            <span
              className={cn(
                "h-full w-px",
                isSidebarDragging ? "bg-primary/30 transition-none" : "bg-transparent transition-colors duration-150 group-hover:bg-primary/30",
              )}
            />
          </button>
        )}

        <div className="flex h-9 items-start overflow-hidden">
          <BrandLogo
            variant="adaptive"
            collapsed={!showExpandedContent}
            className="h-9 w-[148px]"
            imageClassName="origin-left scale-[1.30] object-left -translate-x-[5px]"
          />
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none">
          <SidebarNavContent
            sections={sidebarSections}
            pathname={location.pathname}
            showLabel={showExpandedContent}
          />
        </div>

        <div className="overflow-x-hidden border-t border-border/70 pt-2.5">
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
              icon={SunMoon}
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
                  variant="outline"
                  className="text-foreground hover:text-foreground"
                />
                <FooterActionButton
                  label="Sign Up"
                  icon={UserPlus}
                  expanded={showExpandedContent}
                  onClick={() => navigate("/signup")}
                  className="!bg-ds-accent !font-semibold !text-ink-fixed shadow-sm hover:!bg-ds-accent/85 hover:!text-ink-fixed"
                />
              </>
            )}
          </div>
        </div>
      </aside>

      {isSidebarHidden && (
        <button
          type="button"
          className="fixed left-0 top-3 z-50 hidden h-9 w-6 items-center justify-center rounded-r-lg border border-l-0 border-border/70 bg-card/95 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground lg:inline-flex"
          onClick={() => setIsSidebarHidden(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

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
        ref={contentElementRef}
        style={sidebarLayoutStyle}
        className={cn(
          "sat-resize-transition min-h-screen pt-14 transition-[padding] duration-200 motion-reduce:transition-none lg:pl-[var(--app-sidebar-padding)] lg:pt-0",
          isSidebarDragging && "duration-0",
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
              <Link
                key={item.label}
                to={item.href}
                aria-label={item.label}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card/80 px-1 py-2 text-[11px] font-medium shadow-sm",
                  active ? "border-primary/40 bg-ds-accent text-ink-fixed" : "text-ink-muted hover:text-ink",
                )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                <span className="w-full truncate text-center leading-none">{mobileLabel}</span>
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
};
