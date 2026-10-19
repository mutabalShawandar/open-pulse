import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/lib/api/types";
import { campaignStatuses } from "@/lib/campaign-status";
import { organizationRegistrationEnabled } from "@/lib/features";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { createChallenge, createState, createVerifier } from "@/lib/auth/pkce";
import { buildPublicSurveyUrl, campaignSlugFromPath } from "@/lib/public-link";
import { userDisplayName, userInitials } from "@/lib/user-display";
import en from "@/messages/en.json";

afterEach(() => vi.unstubAllEnvs());

const user = (overrides: Partial<CurrentUser>): CurrentUser => ({
  id: "1",
  email: "ada@example.com",
  display_name: null,
  is_active: true,
  is_platform_admin: false,
  permissions: [],
  ...overrides,
});

describe("public links", () => {
  it("extracts the campaign slug after the last ~", () => {
    expect(campaignSlugFromPath("clinic~spring-2026")).toBe("spring-2026");
    expect(campaignSlugFromPath("plain")).toBe("plain");
  });

  it("builds a relative URL without a root domain", () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "");
    expect(buildPublicSurveyUrl("acme", "acme~survey")).toBe("/respond/acme~survey");
  });

  it("builds a workspace subdomain URL with a root domain", () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "example.org");
    expect(buildPublicSurveyUrl("acme", "acme~survey")).toBe(
      "https://acme.example.org/acme~survey",
    );
  });
});

describe("user display", () => {
  it("prefers the trimmed display name, falls back to email", () => {
    expect(userDisplayName(user({ display_name: "  Ada Lovelace " }))).toBe("Ada Lovelace");
    expect(userDisplayName(user({ display_name: "   " }))).toBe("ada@example.com");
  });

  it("builds up to two uppercase initials", () => {
    expect(userInitials(user({ display_name: "ada king lovelace" }))).toBe("AK");
    expect(userInitials(user({ display_name: "Ada" }))).toBe("A");
  });
});

describe("feature flags", () => {
  it("enables organization registration only for the exact string true", () => {
    vi.stubEnv("ORGANIZATION_REGISTRATION_ENABLED", "true");
    expect(organizationRegistrationEnabled()).toBe(true);
    vi.stubEnv("ORGANIZATION_REGISTRATION_ENABLED", "1");
    expect(organizationRegistrationEnabled()).toBe(false);
    vi.stubEnv("ORGANIZATION_REGISTRATION_ENABLED", "");
    expect(organizationRegistrationEnabled()).toBe(false);
  });
});

describe("locales", () => {
  it("recognises supported locales only", () => {
    expect(locales).toContain(defaultLocale);
    expect(isLocale("de")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("campaign statuses", () => {
  it("has an English label for every status", () => {
    const labels = (en as { campaigns: { status: Record<string, string> } }).campaigns.status;
    for (const status of campaignStatuses) expect(labels[status], status).toBeTruthy();
  });
});

describe("PKCE", () => {
  it("creates URL-safe random values", () => {
    expect(createVerifier()).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(createState()).not.toBe(createState());
  });

  it("matches the RFC 7636 S256 test vector", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(await createChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
