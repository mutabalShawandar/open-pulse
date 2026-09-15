function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function createVerifier(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(48)));
}

export function createState(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}
