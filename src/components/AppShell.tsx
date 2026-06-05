import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { useThemeMode } from "@/hooks/useThemeMode";
import { applyTheme } from "@/lib/theme";

const COLLAPSED_DESKTOP_WIDTH_CLASS = "lg:w-[4.5625rem]";
const COLLAPSED_DESKTOP_PADDING_CLASS = "lg:pl-[4.5625rem]";
const ONBOARDING_REPLAY_REQUEST_KEY = "onboarding-replay-requested";

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

const SidebarLink = ({
  href,
  label,
  icon: Icon,
  active,
  showLabel = false,
  tourId,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  showLabel?: boolean;
  tourId?: string;
}) => {
  return (
    <Link
      to={href}
      aria-label={label}
      title={label}
      data-tour={tourId}
      className={cn(
        // Inter 13px, tracking -0.5%. Default: 500 ink-mid. Active: 600 white
        // on ink-fixed (so the dark pill stays dark in dark mode too).
        "flex h-10 items-center overflow-hidden rounded-lg font-sans text-[13px] tracking-[-0.005em] transition-[background-color,color,box-shadow,width,padding] duration-200 ease-out",
        showLabel ? "w-full pr-3" : "w-10 pr-0",
        active
          ? "bg-ink-fixed font-semibold text-white shadow-sm dark:bg-white dark:text-ink-fixed"
          : "font-medium text-ink-mid hover:bg-ds-accent/25 hover:text-ink dark:hover:bg-white/10",
      )}
    >
      <span className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center transition-opacity",
        active ? "opacity-100" : "opacity-70",
      )}>
        <Icon className="h-4 w-4 shrink-0" />
      </span>
      <span
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-200 ease-out",
          showLabel ? "ml-0 max-w-[10rem] opacity-100 translate-x-0" : "ml-0 max-w-0 opacity-0 -translate-x-1",
        )}
      >
        {label}
      </span>
    </Link>
  );
};

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
        // Footer buttons — Inter 500, 13px, ink.
        "flex h-10 items-center overflow-hidden rounded-lg font-sans text-[13px] font-medium text-ink transition-[background-color,color,box-shadow,width,padding] duration-200 ease-out",
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
          "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-200 ease-out",
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
  // Embed mode (used by the homepage iframe demos): render children only,
  // skip the sidebar/topbar chrome so the iframed page looks like the real
  // page without our nav wrapper.
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
  const isDesktopCollapsed = isSidebarHidden;
  const showExpandedContent = !isDesktopCollapsed;

  const activePrimary = useMemo(
    () => primaryItems.find((item) => item.match(location.pathname))?.label,
    [location.pathname],
  );

  const activeSecondary = useMemo(
    () => secondaryItems.find((item) => item.match(location.pathname))?.label,
    [location.pathname],
  );

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
        data-tour="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col overscroll-x-none border-r border-border/60 bg-card/95 py-3 backdrop-blur transition-[width,transform] duration-200 ease-out lg:px-4",
          isSidebarHidden
            ? `w-72 -translate-x-full px-4 ${COLLAPSED_DESKTOP_WIDTH_CLASS} lg:translate-x-0`
            : "w-72 translate-x-0 px-4 lg:w-64",
        )}
      >
        <button
          type="button"
          className={cn(
            "top-3 z-50 hidden items-center justify-center text-muted-foreground transition-all duration-200 ease-out hover:text-foreground lg:inline-flex",
            isSidebarHidden
              ? "fixed left-[4.5rem] h-8 w-6 rounded-r-lg border border-l-0 border-border/70 bg-card/95 shadow-sm"
              : "absolute right-4 h-9 w-9 rounded-lg",
          )}
          onClick={() => setIsSidebarHidden((hidden) => !hidden)}
          aria-label={isSidebarHidden ? "Expand sidebar" : "Hide sidebar"}
          title={isSidebarHidden ? "Expand sidebar" : "Hide sidebar"}
        >
          {isSidebarHidden ? (
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

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none">
          <div className="space-y-1">
            {primaryItems.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={activePrimary === item.label}
                showLabel={showExpandedContent}
                tourId={item.tourId}
              />
            ))}
          </div>

          <div className="mt-5 h-4 overflow-hidden px-3">
            <div className="relative h-4">
              <div
                aria-hidden={!showExpandedContent}
                className={cn(
                  "ds-caption absolute left-0 top-1/2 -translate-y-1/2 transition-opacity duration-200 ease-out",
                  showExpandedContent ? "opacity-100" : "opacity-0",
                )}
              >
                Account
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-1/2 block h-px w-6 -translate-y-1/2 rounded-full bg-border/90 transition-opacity duration-200 ease-out",
                  showExpandedContent ? "opacity-0" : "opacity-100",
                )}
              />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {secondaryItems.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={activeSecondary === item.label}
                showLabel={showExpandedContent}
                tourId={item.tourId}
              />
            ))}
          </div>
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
                  // Sign Up — Inter 600, 13px. Text uses ink-fixed so it
                  // stays dark on the always-light accent fill in dark mode.
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
        className={cn(
          "min-h-screen pt-14 transition-[padding] duration-200 ease-out lg:pt-0",
          isSidebarHidden ? COLLAPSED_DESKTOP_PADDING_CLASS : "lg:pl-64",
        )}
      >
        <nav
          aria-label="Primary mobile navigation"
          className="mx-auto mb-2 grid max-w-2xl grid-cols-5 gap-1 px-3 lg:hidden"
        >
          {mobileItems.map((item) => {
            const active = item.match(location.pathname);
            const Icon = item.icon;
            const mobileLabel = mobileLabelByHref[item.href] ?? item.label;

            return (
              <Link
                key={item.label}
                to={item.href}
                aria-label={item.label}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card/80 px-1 py-2 text-[11px] font-medium shadow-sm transition-colors",
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
