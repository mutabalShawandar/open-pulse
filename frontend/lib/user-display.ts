import type { CurrentUser } from "@/lib/api/types";

export function userDisplayName(user: CurrentUser): string {
  return user.display_name?.trim() || user.email;
}

export function userInitials(user: CurrentUser): string {
  const words = userDisplayName(user).split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}
