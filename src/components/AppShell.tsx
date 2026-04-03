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
  { label: "Profile", href: "/profile", icon: Settings, match: (pathname: string) => pathname.startsWith("/profile") },
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
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) => (
  <Link
    to={href}
    className={cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-foreground text-background shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    )}
  >
    <Icon className="h-4 w-4 shrink-0" />
    <span>{label}</span>
  </Link>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isSidebarHidden, setIsSidebarHidden] = useState(isSidebarHiddenFromSession);

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
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border/60 bg-card/95 px-4 py-5 backdrop-blur transition-transform duration-300",
          isSidebarHidden ? "-translate-x-full" : "translate-x-0",
        )}
      >
        <div className="px-2">
          <BrandLogo variant="mark" className="h-10 w-10" />
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
              />
            ))}
          </div>

          <div className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Account
          </div>
          <div className="mt-3 space-y-1">
            {secondaryItems.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={activeSecondary === item.label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 border-t border-border/70 pt-4">
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
              <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/profile")}>
                <Settings className="h-4 w-4" />
                Profile
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/analysis")}>
                <BarChart3 className="h-4 w-4" />
                Statistics
              </Button>
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

        </div>
      </aside>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "fixed left-0 top-1/2 z-50 h-12 w-7 -translate-y-1/2 rounded-l-none rounded-r-xl border-l-0 bg-card/95 pr-1.5 shadow-lg backdrop-blur transition-transform duration-300",
          isSidebarHidden ? "translate-x-0" : "translate-x-0",
        )}
        onClick={() => setIsSidebarHidden((hidden) => !hidden)}
        aria-label={isSidebarHidden ? "Show sidebar" : "Hide sidebar"}
      >
        {isSidebarHidden ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      <div className={cn("min-h-screen transition-[padding] duration-300", !isSidebarHidden && "lg:pl-72")}>
        {children}
      </div>
    </div>
  );
};
