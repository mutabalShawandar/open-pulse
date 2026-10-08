import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, localeCookie, type Locale } from "./config";

// Locale is stored in a cookie rather than the URL so existing routes
// (including public /respond/{slug} links) stay stable. English is the default;
// a browser that only asks for German gets German until the user picks one.
async function resolveLocale(): Promise<Locale> {
  const stored = (await cookies()).get(localeCookie)?.value;
  if (isLocale(stored)) return stored;
  const accepted = (await headers()).get("accept-language") ?? "";
  const ranked = accepted
    .split(",")
    .map((entry, index) => {
      const [range, ...params] = entry.trim().toLowerCase().split(";");
      const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { language: range.slice(0, 2), quality, index };
    })
    .filter((entry) => isLocale(entry.language) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  const best = ranked[0]?.language;
  return isLocale(best) ? best : defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
