import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RedirectError, navigationMock, translationsMock } from "./helpers/next-mocks";

vi.mock("next/navigation", () => navigationMock);
vi.mock("next-intl/server", () => ({ getTranslations: translationsMock() }));
vi.mock("@/lib/auth/session", () => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getSmtpConfiguration: vi.fn(),
  listPlatformUsers: vi.fn(),
}));

// Client components are out of scope for page-level tests; render a marker instead.
const stub = vi.hoisted(() => (name: string) => ({ [name]: () => `[${name}]` }));
vi.mock("@/components/administration/smtp-configuration-form", () => stub("SmtpConfigurationForm"));
vi.mock("@/components/administration/create-user-form", () => stub("CreateUserForm"));
vi.mock("@/components/administration/deactivate-user-dialog", () => stub("DeactivateUserDialog"));
vi.mock("@/components/administration/reactivate-user-button", () => stub("ReactivateUserButton"));
vi.mock("@/components/administration/permanently-delete-user-dialog", () =>
  stub("PermanentlyDeleteUserDialog"),
);

import EmailAdministrationPage from "@/app/(platform)/administration/email/page";
import UsersPage from "@/app/(platform)/administration/users/page";
import { ApiError, getSmtpConfiguration, listPlatformUsers } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessToken } from "@/lib/auth/session";

const me = {
  id: "me",
  email: "me@x.io",
  display_name: "Me",
  is_active: true,
  is_platform_admin: true,
  permissions: ["user.manage"],
};
const other = { id: "o1", email: "other@x.io", display_name: "Other", is_active: true };
const gone = { id: "o2", email: "gone@x.io", display_name: null, is_active: false };

// Page props are typed by Next's generated route types; tests only need searchParams.
const props = (query: Record<string, string> = {}) =>
  ({ searchParams: Promise.resolve(query) }) as never;

async function render(page: Promise<React.ReactNode>) {
  return renderToStaticMarkup(await page);
}

beforeEach(() => {
  vi.mocked(requireUser).mockResolvedValue(me);
  vi.mocked(getAccessToken).mockResolvedValue("token");
});
afterEach(() => vi.resetAllMocks());

describe("Administration > Email page", () => {
  it("shows the SMTP form when the configuration loads", async () => {
    vi.mocked(getSmtpConfiguration).mockResolvedValue(null);
    const html = await render(EmailAdministrationPage(props()));
    expect(html).toContain("[SmtpConfigurationForm]");
    expect(html).not.toContain("unavailableTitle");
  });

  it("redirects to /access-denied on 403 instead of a 404-style message", async () => {
    vi.mocked(getSmtpConfiguration).mockRejectedValue(new ApiError(403));
    await expect(EmailAdministrationPage(props())).rejects.toEqual(
      new RedirectError("/access-denied"),
    );
  });

  it("shows the 404 message and hides the form when the endpoint is missing", async () => {
    vi.mocked(getSmtpConfiguration).mockRejectedValue(new ApiError(404));
    const html = await render(EmailAdministrationPage(props()));
    expect(html).toContain("admin.email.unavailable404");
    expect(html).not.toContain("[SmtpConfigurationForm]");
  });

  it("shows the generic message for other failures", async () => {
    vi.mocked(getSmtpConfiguration).mockRejectedValue(new ApiError(500));
    const html = await render(EmailAdministrationPage(props()));
    expect(html).toContain("admin.email.unavailableGeneric");
  });

  it("shows saved and error banners from the query string", async () => {
    vi.mocked(getSmtpConfiguration).mockResolvedValue(null);
    const saved = await render(EmailAdministrationPage(props({ saved: "1" })));
    expect(saved).toContain("admin.email.saved");
    const failed = await render(EmailAdministrationPage(props({ error: "1" })));
    expect(failed).toContain("admin.email.actionError");
  });

  it("renders nothing without an access token", async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    expect(await EmailAdministrationPage(props())).toBeNull();
  });
});

describe("Administration > Users page", () => {
  beforeEach(() => {
    vi.mocked(listPlatformUsers).mockResolvedValue([me, other, gone]);
  });

  it("redirects to /access-denied on 403 instead of crashing", async () => {
    vi.mocked(listPlatformUsers).mockRejectedValue(new ApiError(403));
    await expect(UsersPage(props())).rejects.toEqual(new RedirectError("/access-denied"));
  });

  it("rethrows unexpected API errors", async () => {
    vi.mocked(listPlatformUsers).mockRejectedValue(new ApiError(500));
    await expect(UsersPage(props())).rejects.toMatchObject({ status: 500 });
  });

  it("lists every user with an active/inactive status", async () => {
    const html = await render(UsersPage(props()));
    for (const user of [me, other, gone]) expect(html).toContain(user.email);
    expect(html).toContain("admin.users.active");
    expect(html).toContain("admin.users.inactive");
  });

  it("offers no deactivate or delete action for the signed-in administrator", async () => {
    vi.mocked(listPlatformUsers).mockResolvedValue([me]);
    const html = await render(UsersPage(props()));
    expect(html).not.toContain("[DeactivateUserDialog]");
    expect(html).not.toContain("[PermanentlyDeleteUserDialog]");
  });

  it("offers deactivate for active users and reactivate for inactive ones", async () => {
    const html = await render(UsersPage(props()));
    expect(html.match(/\[DeactivateUserDialog\]/g)).toHaveLength(1);
    expect(html.match(/\[ReactivateUserButton\]/g)).toHaveLength(1);
    expect(html.match(/\[PermanentlyDeleteUserDialog\]/g)).toHaveLength(2);
  });

  it("maps the error query to a specific or generic message", async () => {
    expect(await render(UsersPage(props({ error: "exists" })))).toContain(
      "admin.users.errorExists",
    );
    expect(await render(UsersPage(props({ error: "boom" })))).toContain("admin.users.errorGeneric");
  });

  it("shows the success notice for a created user", async () => {
    expect(await render(UsersPage(props({ created: "1" })))).toContain("admin.users.created");
  });
});
