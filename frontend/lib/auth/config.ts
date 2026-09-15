function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const authConfig = {
  apiBaseUrl: required("NEXT_PUBLIC_API_BASE_URL").replace(/\/$/, ""),
  keycloakClientId: required("KEYCLOAK_FRONTEND_CLIENT_ID"),
  keycloakIssuer: required("KEYCLOAK_ISSUER").replace(/\/$/, ""),
  keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
  appUrl: required("APP_URL").replace(/\/$/, ""),
};

export const authEndpoints = {
  authorization: `${authConfig.keycloakIssuer}/protocol/openid-connect/auth`,
  token: `${authConfig.keycloakIssuer}/protocol/openid-connect/token`,
};
