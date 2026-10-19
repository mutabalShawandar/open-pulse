import type { CurrentUser } from "@/lib/api/types";

// Mirrors the backend: user administration needs "user.manage"; SMTP settings
// need the platform_admin role. This only hides links; the API still enforces access.
export function canManageUsers(user: CurrentUser): boolean {
  return user.permissions.includes("user.manage");
}

export function canConfigureEmail(user: CurrentUser): boolean {
  return user.is_platform_admin;
}

export function canSeeNavigationItem(user: CurrentUser, key: string): boolean {
  if (key === "administration") return canManageUsers(user);
  if (key === "email") return canConfigureEmail(user);
  return true;
}
