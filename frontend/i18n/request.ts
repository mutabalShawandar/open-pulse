import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, localeCookie, type Locale } from "./config";

// Locale is stored in a cookie rather than the URL so existing routes
// (including public /respond/{slug} links) stay stable. English is the default;
// a browser that only asks for German gets German until the user picks one.
async function resolveLocale(): Promise<Locale> {
  const stored = (await cookies()).get(localeCookie)?.value;
  if (isLocale(stored)) return stored;
  const accepted = ((await headers()).get("accept-language") ?? "").toLowerCase();
  const first = accepted.split(",")[0]?.trim().slice(0, 2);
  return isLocale(first) ? first : defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
