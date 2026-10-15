// Read at request time on the server (not NEXT_PUBLIC_), so it can be flipped
// without rebuilding the image. Mirrors the backend ORGANIZATION_REGISTRATION_ENABLED.
export function organizationRegistrationEnabled(): boolean {
  return process.env.ORGANIZATION_REGISTRATION_ENABLED === "true";
}
