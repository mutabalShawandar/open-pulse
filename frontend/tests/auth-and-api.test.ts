import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError, RedirectError, navigationMock } from "./helpers/next-mocks";

vi.mock("next/navigation", () => navigationMock);
vi.mock("@/lib/auth/session", () => ({ getAccessToken: vi.fn() }));

import { ApiError, getCurrentUser } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessToken } from "@/lib/auth/session";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";

const activeUser = {
  id: "u1",
  email: "a@b.c",
  display_name: null,
  is_active: true,
  is_platform_admin: false,
  permissions: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.mocked(getAccessToken).mockResolvedValue("token");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("API client", () => {
  it("sends the bearer token and returns the parsed body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(activeUser));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser("abc")).resolves.toEqual(activeUser);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/me$/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer abc");
  });

  it("throws ApiError with status and the backend detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "nope" }, 403)));
    await expect(getCurrentUser("abc")).rejects.toMatchObject({ status: 403, detail: "nope" });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));
    const error = await getCurrentUser("abc").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("API request failed with status 502");
  });
});

describe("requireUser", () => {
  it("redirects to /login without a session cookie", async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    await expect(requireUser()).rejects.toEqual(new RedirectError("/login"));
  });

  it("returns the user when the session is valid and active", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(activeUser)));
    await expect(requireUser()).resolves.toEqual(activeUser);
  });

  it("redirects inactive users to /access-denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ...activeUser, is_active: false })),
    );
    await expect(requireUser()).rejects.toEqual(new RedirectError("/access-denied"));
  });

  it("redirects to /access-denied when the backend answers 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "x" }, 403)));
    await expect(requireUser()).rejects.toEqual(new RedirectError("/access-denied"));
  });

  it("redirects to /login when the token is rejected or the API is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "x" }, 401)));
    await expect(requireUser()).rejects.toEqual(new RedirectError("/login"));

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(requireUser()).rejects.toEqual(new RedirectError("/login"));
  });
});

describe("resolveWorkspaceBySlug", () => {
  const workspace = { id: "w1", slug: "demo", name: "Demo" };

  it("returns the workspace whose slug matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([workspace])));
    await expect(resolveWorkspaceBySlug("token", "demo")).resolves.toEqual(workspace);
  });

  it("calls notFound() for an unknown slug", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([workspace])));
    await expect(resolveWorkspaceBySlug("token", "other")).rejects.toBeInstanceOf(NotFoundError);
  });
});
