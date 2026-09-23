import { Spinner } from "@/components/ui/spinner";

export default function ClinicViewLoading() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center" aria-live="polite" aria-label="Klinikbereich wird geladen">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <Spinner className="text-primary" />
        <span className="text-sm font-medium">Klinikbereich wird geladen …</span>
      </div>
    </main>
  );
}
