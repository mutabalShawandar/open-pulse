import { getTranslations } from "next-intl/server";

import { Spinner } from "@/components/ui/spinner";

export default async function WorkspaceViewLoading() {
  const t = await getTranslations("workspaces");
  return (
    <main className="flex min-h-[50vh] items-center justify-center" aria-live="polite" aria-label={t("loading")}>
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <Spinner className="text-primary" />
        <span className="text-sm font-medium">{t("loadingText")}</span>
      </div>
    </main>
  );
}
