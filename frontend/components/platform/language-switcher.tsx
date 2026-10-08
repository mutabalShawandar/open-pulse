"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { localeCookie, locales } from "@/i18n/config";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();

  function change(next: string) {
    document.cookie = `${localeCookie}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(event) => change(event.target.value)}
      className="h-8 rounded-md border bg-background px-2 text-sm"
    >
      {locales.map((code) => (
        <option key={code} value={code}>{t(code)}</option>
      ))}
    </select>
  );
}
