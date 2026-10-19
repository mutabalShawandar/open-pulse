import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Required by lib/auth/config.ts at import time; fixed here so tests never
    // depend on the developer's shell or on real services.
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://api.test",
      APP_URL: "http://app.test",
      KEYCLOAK_ISSUER: "http://keycloak.test/realms/openpulse",
      KEYCLOAK_FRONTEND_CLIENT_ID: "openpulse-frontend",
    },
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
