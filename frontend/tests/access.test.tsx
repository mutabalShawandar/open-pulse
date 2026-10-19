import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { canConfigureEmail, canManageUsers, canSeeNavigationItem } from "@/lib/access";
import type { CurrentUser } from "@/lib/api/types";

const user = (overrides: Partial<CurrentUser> = {}): CurrentUser => ({
  id: "1",
  email: "a@b.c",
  display_name: "Ada",
  is_active: true,
  is_platform_admin: false,
  permissions: [],
  ...overrides,
});

describe("access helpers", () => {
  it("gives an unassigned user no administration access", () => {
    expect(canManageUsers(user())).toBe(false);
    expect(canConfigureEmail(user())).toBe(false);
  });

  it("derives access from permissions and the platform admin flag", () => {
    expect(canManageUsers(user({ permissions: ["user.manage"] }))).toBe(true);
    expect(canConfigureEmail(user({ is_platform_admin: true }))).toBe(true);
  });

  it("never hides the regular navigation items", () => {
    for (const key of ["overview", "surveys", "workspaces"]) {
      expect(canSeeNavigationItem(user(), key)).toBe(true);
    }
  });
});

describe("dashboard sidebar", () => {
  const render = (u: CurrentUser) => renderToStaticMarkup(<DashboardSidebar user={u} />);

  it("hides Administration and Email from unassigned users", () => {
    const html = render(user());
    expect(html).not.toContain("/administration/users");
    expect(html).not.toContain("/administration/email");
    expect(html).toContain('href="/surveys"');
  });

  it("shows both for a platform administrator", () => {
    const html = render(user({ is_platform_admin: true, permissions: ["user.manage"] }));
    expect(html).toContain("/administration/users");
    expect(html).toContain("/administration/email");
  });
});
