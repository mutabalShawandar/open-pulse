"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
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
import { getHelpTopic, type HelpTopic } from "@/lib/help/help-content";

function HelpWalkthrough({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = topic.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === topic.steps.length - 1;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{topic.title}</DialogTitle>
        <DialogDescription>
          Schritt {stepIndex + 1} von {topic.steps.length}
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
          Zurück
        </Button>
        {isLast ? (
          <Button onClick={onClose}>Fertig</Button>
        ) : (
          <Button onClick={() => setStepIndex((index) => Math.min(topic.steps.length - 1, index + 1))}>
            Weiter
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

export function HelpGuide() {
  const pathname = usePathname();
  const topic = getHelpTopic(pathname ?? "/");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Hilfe für diesen Bereich anzeigen" />
        }
      >
        <HelpCircleIcon />
      </DialogTrigger>
      <DialogContent>
        <HelpWalkthrough key={`${pathname}-${open}`} topic={topic} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
