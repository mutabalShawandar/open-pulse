import { Spinner } from "@/components/ui/spinner";

export default function PublicSurveyLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background" aria-live="polite" aria-label="Umfrage wird geladen">
      <Spinner className="size-6 text-primary" />
    </main>
  );
}
