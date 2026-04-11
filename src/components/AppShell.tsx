import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Home,
  LogIn,
  LogOut,
  Settings,
  SpellCheck,
  Target,
  UserPlus,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const COLLAPSED_DESKTOP_WIDTH_CLASS = "lg:w-[4.5rem]";
const COLLAPSED_DESKTOP_PADDING_CLASS = "lg:pl-[4.5rem]";

const primaryItems = [
  { label: "Home", href: "/", icon: Home, match: (pathname: string) => pathname === "/" },
  { label: "Question Bank", href: "/bank", icon: BookOpen, match: (pathname: string) => pathname.startsWith("/bank") || pathname.startsWith("/official-bank") },
  { label: "100 Hard Math Questions", href: "/hard", icon: Target, match: (pathname: string) => pathname.startsWith("/hard") },
  { label: "Score Calculator", href: "/score-calculator", icon: Calculator, match: (pathname: string) => pathname.startsWith("/score-calculator") },
  { label: "Practice Modules", href: "/modules", icon: GraduationCap, match: (pathname: string) => pathname.startsWith("/modules") },
  { label: "Vocabulary", href: "/vocab", icon: SpellCheck, match: (pathname: string) => pathname.startsWith("/vocab") },
];

const secondaryItems = [
  { label: "Settings", href: "/profile", icon: Settings, match: (pathname: string) => pathname.startsWith("/profile") },
  { label: "Statistics", href: "/analysis", icon: BarChart3, match: (pathname: string) => pathname.startsWith("/analysis") },
];

const SidebarLink = ({
  href,
  label,
  icon: Icon,
  active,
  showLabel = false,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  showLabel?: boolean;
}) => {
  return (
    <Link
      to={href}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 items-center overflow-hidden rounded-lg text-[13px] font-medium transition-[background-color,color,box-shadow,width,padding] duration-200 ease-out",
        showLabel ? "w-full pr-2" : "w-9 pr-0",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4 shrink-0" />
      </span>
      <span
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-200 ease-out",
          showLabel ? "ml-0.5 max-w-[10rem] opacity-100 translate-x-0" : "ml-0 max-w-0 opacity-0 -translate-x-1",
        )}
      >
        {label}
      </span>
    </Link>
  );
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [showExpandedFooter, setShowExpandedFooter] = useState(false);
  const isDesktopCollapsed = isSidebarHidden;
  const showExpandedContent = !isDesktopCollapsed;

  useEffect(() => {
    if (isDesktopCollapsed) {
      setShowExpandedFooter(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowExpandedFooter(true);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [isDesktopCollapsed]);

  const activePrimary = useMemo(
    () => primaryItems.find((item) => item.match(location.pathname))?.label,
    [location.pathname],
  );

  const activeSecondary = useMemo(
    () => secondaryItems.find((item) => item.match(location.pathname))?.label,
    [location.pathname],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/60 bg-card/95 py-3 backdrop-blur transition-[width,transform] duration-200 ease-out lg:px-4",
          isSidebarHidden
            ? `w-72 -translate-x-full px-4 ${COLLAPSED_DESKTOP_WIDTH_CLASS} lg:translate-x-0`
            : "w-72 translate-x-0 px-4 lg:w-64",
        )}
      >
        <button
          type="button"
          className={cn(
            "absolute top-3 z-10 hidden items-center justify-center text-muted-foreground transition-all duration-200 ease-out hover:text-foreground lg:inline-flex",
            isSidebarHidden
              ? "left-full h-8 w-6 rounded-r-lg border border-l-0 border-border/70 bg-card/95 shadow-sm"
              : "right-4 h-9 w-9 rounded-lg",
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
            variant={showExpandedContent ? "full" : "mark"}
            className={showExpandedContent ? "h-9 w-[148px]" : "h-9 w-9"}
            imageClassName={showExpandedContent ? "origin-left scale-[1.26] object-left -translate-x-[3px]" : undefined}
          />
        </div>

        <div className="mt-3 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {primaryItems.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={activePrimary === item.label}
                showLabel={showExpandedContent}
              />
            ))}
          </div>

          <div className="mt-4 px-2.5">
            {showExpandedContent ? (
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Account
              </div>
            ) : (
              <div className="flex h-4 items-center justify-start">
                <span className="block h-px w-6 rounded-full bg-border/90" />
              </div>
            )}
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
              />
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-border/70 pt-2.5">
          {showExpandedFooter ? (
            <>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2">
                <div>
                  <p className="text-[13px] font-medium leading-none">Theme</p>
                  <p className="mt-1 text-[11px] leading-none text-muted-foreground">Light or dark mode</p>
                </div>
                <ThemeToggle />
              </div>

              {user ? (
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/70 p-2.5">
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  <Button type="button" variant="outline" className="h-8 w-full justify-start gap-2 text-red-600 hover:text-red-700" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/70 p-2.5">
                  <Button type="button" variant="outline" className="h-8 w-full justify-start gap-2" onClick={() => navigate("/login")}>
                    <LogIn className="h-4 w-4" />
                    Log In
                  </Button>
                  <Button type="button" className="h-8 w-full justify-start gap-2" onClick={() => navigate("/signup")}>
                    <UserPlus className="h-4 w-4" />
                    Sign Up
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-start gap-1.5">
              <ThemeToggle compact />

              {user ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleSignOut}
                  aria-label="Log out"
                  title={user.email ? `Log out (${user.email})` : "Log out"}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => navigate("/login")}
                    aria-label="Log In"
                    title="Log In"
                  >
                    <LogIn className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => navigate("/signup")}
                    aria-label="Sign Up"
                    title="Sign Up"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "fixed left-0 top-5 z-50 h-12 w-7 rounded-l-none rounded-r-xl border-l-0 bg-card/95 pr-1.5 shadow-lg backdrop-blur transition-transform duration-300 lg:hidden",
          isSidebarHidden ? "translate-x-0" : "-translate-x-full",
        )}
        onClick={() => setIsSidebarHidden((hidden) => !hidden)}
        aria-label={isSidebarHidden ? "Show sidebar" : "Hide sidebar"}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200 ease-out",
          isSidebarHidden ? COLLAPSED_DESKTOP_PADDING_CLASS : "lg:pl-64",
        )}
      >
        {children}
      </div>
    </div>
  );
};
