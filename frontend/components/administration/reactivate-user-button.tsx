"use client";

import { RotateCcwIcon } from "lucide-react";

import { reactivateUserAction } from "@/app/(platform)/administration/users/actions";
import { Button } from "@/components/ui/button";

export function ReactivateUserButton({ userId }: { userId: string }) {
  return (
    <form action={reactivateUserAction}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="ghost" size="sm">
        <RotateCcwIcon data-icon="inline-start" />
        Reaktivieren
      </Button>
    </form>
  );
}
