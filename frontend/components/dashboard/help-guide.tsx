"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon, HelpCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getHelpTopicId } from "@/lib/help/help-content";

function HelpWalkthrough({ topicId, onClose }: { topicId: string; onClose: () => void }) {
  const t = useTranslations("help");
  const topic = { title: t(`topics.${topicId}.title`), steps: t.raw(`topics.${topicId}.steps`) as { title: string; description: string }[] };
  const [stepIndex, setStepIndex] = useState(0);
  const step = topic.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === topic.steps.length - 1;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{topic.title}</DialogTitle>
        <DialogDescription>
          {t("step", { current: stepIndex + 1, total: topic.steps.length })}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{step.title}</p>
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {topic.steps.map((_, index) => (
          <span
            key={index}
            className={
              index === stepIndex
                ? "h-1.5 w-4 rounded-full bg-primary"
                : "h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
            }
          />
        ))}
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <Button
          variant="outline"
          disabled={isFirst}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("back")}
        </Button>
        {isLast ? (
          <Button onClick={onClose}>{t("done")}</Button>
        ) : (
          <Button onClick={() => setStepIndex((index) => Math.min(topic.steps.length - 1, index + 1))}>
            {t("next")}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

export function HelpGuide() {
  const t = useTranslations("help");
  const pathname = usePathname();
  const topicId = getHelpTopicId(pathname ?? "/");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t("ariaLabel")} />
        }
      >
        <HelpCircleIcon />
      </DialogTrigger>
      <DialogContent>
        <HelpWalkthrough key={`${pathname}-${open}`} topicId={topicId} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
