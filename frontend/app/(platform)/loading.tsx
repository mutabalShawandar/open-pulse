import { Spinner } from "@/components/ui/spinner";

export default function PlatformLoading() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center" aria-live="polite" aria-label="Inhalt wird geladen">
      <Spinner className="size-6 text-primary" />
    </main>
  );
}
