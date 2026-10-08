function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const authConfig = {
  // Runs server-side (Server Components/Actions). INTERNAL_API_BASE_URL lets the
  // container reach the backend over the Docker network (e.g. "http://backend:8000")
  // when it differs from the browser-facing NEXT_PUBLIC_API_BASE_URL.
  apiBaseUrl: (process.env.INTERNAL_API_BASE_URL || required("NEXT_PUBLIC_API_BASE_URL")).replace(/\/$/, ""),
  keycloakClientId: required("KEYCLOAK_FRONTEND_CLIENT_ID"),
  keycloakIssuer: required("KEYCLOAK_ISSUER").replace(/\/$/, ""),
  // Middleware and route handlers run server-side and call Keycloak directly
  // (not through the browser), so they need the in-network Keycloak address
  // (e.g. "http://keycloak:8080/realms/openpulse") when it differs from the
  // browser-facing KEYCLOAK_ISSUER.
  keycloakInternalIssuer: (process.env.KEYCLOAK_INTERNAL_ISSUER || process.env.KEYCLOAK_ISSUER || "").replace(/\/$/, ""),
  keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
  appUrl: required("APP_URL").replace(/\/$/, ""),
};

export const authEndpoints = {
  authorization: `${authConfig.keycloakIssuer}/protocol/openid-connect/auth`,
  endSession: `${authConfig.keycloakIssuer}/protocol/openid-connect/logout`,
  token: `${authConfig.keycloakInternalIssuer}/protocol/openid-connect/token`,
};

// When NEXT_PUBLIC_ROOT_DOMAIN is set, each organization is served on its own
// "app.{org-slug}.{root}" subdomain (see proxy.ts). Keycloak's redirect URI
// matching only supports a trailing-path wildcard, never a wildcard host
// segment, so the OIDC flow itself always runs on the single canonical
// "app.{root}" host (the one exact redirect URI already registered in the
// realm); org subdomains are round-tripped through it via `return_to`
// (see auth/login and auth/callback), relying on the session cookie being
// domain-wide once NEXT_PUBLIC_ROOT_DOMAIN is configured (see session.ts).
export function isOrganizationAppHost(hostname: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain) return null;
  const match = hostname.match(/^app\.([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.([^.]+(?:\.[^.]+)*)$/);
  if (!match || match[2] !== rootDomain) return null;
  return match[1];
}

export function isCanonicalPlatformHost(hostname: string): boolean {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain) return false;
  return hostname === `app.${rootDomain}` || hostname === `staging-app.${rootDomain}`;
}
