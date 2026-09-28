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
  token: `${authConfig.keycloakInternalIssuer}/protocol/openid-connect/token`,
};
