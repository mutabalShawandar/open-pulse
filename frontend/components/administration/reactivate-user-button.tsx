"use client";

import { useTranslations } from "next-intl";
import { RotateCcwIcon } from "lucide-react";

import { reactivateUserAction } from "@/app/(platform)/administration/users/actions";
import { Button } from "@/components/ui/button";

export function ReactivateUserButton({ userId }: { userId: string }) {
  const t = useTranslations("admin.users");
  return (
    <form action={reactivateUserAction}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="ghost" size="sm">
        <RotateCcwIcon data-icon="inline-start" />
        {t("reactivate")}
      </Button>
    </form>
  );
}
