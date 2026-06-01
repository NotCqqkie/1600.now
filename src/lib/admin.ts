import type { AppUser } from "@/contexts/AuthContext";

export const isAdminUser = (user: AppUser | null): boolean =>
  !!user && user.emailVerified && user.isAdmin;
