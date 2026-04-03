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

const SIDEBAR_HIDDEN_KEY = "app-shell-sidebar-hidden";

const primaryItems = [
  { label: "Home", href: "/", icon: Home, match: (pathname: string) => pathname === "/" },
  { label: "Question Bank", href: "/bank", icon: BookOpen, match: (pathname: string) => pathname.startsWith("/bank") || pathname.startsWith("/official-bank") },
  { label: "100 Hard Questions", href: "/hard/1", icon: Target, match: (pathname: string) => pathname.startsWith("/hard/") },
  { label: "Score Calculator", href: "/score-calculator", icon: Calculator, match: (pathname: string) => pathname.startsWith("/score-calculator") },
  { label: "Practice Modules", href: "/modules", icon: GraduationCap, match: (pathname: string) => pathname.startsWith("/modules") },
  { label: "Vocabulary", href: "/vocab", icon: SpellCheck, match: (pathname: string) => pathname.startsWith("/vocab") },
];

const secondaryItems = [
  { label: "Settings", href: "/profile", icon: Settings, match: (pathname: string) => pathname.startsWith("/profile") },
  { label: "Statistics", href: "/analysis", icon: BarChart3, match: (pathname: string) => pathname.startsWith("/analysis") },
];

const isSidebarHiddenFromSession = () => {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SIDEBAR_HIDDEN_KEY) === "true";
};

const SidebarLink = ({
  href,
  label,
  icon: Icon,
  active,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  collapsed?: boolean;
}) => (
  <Link
    to={href}
    aria-label={label}
    title={collapsed ? label : undefined}
    className={cn(
      "flex items-center rounded-xl text-sm font-medium transition-colors",
      collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5",
      active
        ? "bg-foreground text-background shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    )}
  >
    <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
    <span className={cn(collapsed && "sr-only")}>{label}</span>
  </Link>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isSidebarHidden, setIsSidebarHidden] = useState(isSidebarHiddenFromSession);
  const isDesktopCollapsed = isSidebarHidden;

  useEffect(() => {
    sessionStorage.setItem(SIDEBAR_HIDDEN_KEY, String(isSidebarHidden));
  }, [isSidebarHidden]);

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
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/60 bg-card/95 py-5 backdrop-blur transition-[width,transform,padding] duration-300",
          isSidebarHidden
            ? "w-72 -translate-x-full px-4 lg:w-20 lg:translate-x-0 lg:px-3"
            : "w-72 translate-x-0 px-4",
        )}
      >
        <div className={cn("px-2", isDesktopCollapsed ? "flex flex-col items-center gap-3 px-0" : "flex items-start justify-between")}>
          <BrandLogo variant="mark" className="h-10 w-10" />
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
              isDesktopCollapsed ? "h-8 w-8 rounded-xl border border-border/70 bg-background/70" : "mt-1 h-6 w-6",
            )}
            onClick={() => setIsSidebarHidden((hidden) => !hidden)}
            aria-label={isDesktopCollapsed ? "Expand sidebar" : "Hide sidebar"}
            title={isDesktopCollapsed ? "Expand sidebar" : "Hide sidebar"}
          >
            {isDesktopCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {primaryItems.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={activePrimary === item.label}
                collapsed={isDesktopCollapsed}
              />
            ))}
          </div>

          {!isDesktopCollapsed && (
            <div className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Account
            </div>
          )}
          <div className="mt-3 space-y-1">
            {secondaryItems.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={activeSecondary === item.label}
                collapsed={isDesktopCollapsed}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 border-t border-border/70 pt-4">
          {isDesktopCollapsed ? (
            <div className="flex flex-col items-center gap-2">
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
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">Light or dark mode</p>
                </div>
                <ThemeToggle />
              </div>

              {user ? (
                <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  <Button type="button" variant="outline" className="w-full justify-start gap-2 text-red-600 hover:text-red-700" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
                  <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/login")}>
                    <LogIn className="h-4 w-4" />
                    Log In
                  </Button>
                  <Button type="button" className="w-full justify-start gap-2" onClick={() => navigate("/signup")}>
                    <UserPlus className="h-4 w-4" />
                    Sign Up
                  </Button>
                </div>
              )}
            </>
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

      <div className={cn("min-h-screen transition-[padding] duration-300", isSidebarHidden ? "lg:pl-20" : "lg:pl-72")}>
        {children}
      </div>
    </div>
  );
};
