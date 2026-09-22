import { CalendarX2, ClipboardCheck, ShieldCheck } from "lucide-react";

export default function PublicSurveyUnavailablePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-10 text-slate-900">
      <div aria-hidden="true" className="absolute -left-24 top-0 size-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -right-24 size-96 rounded-full bg-teal-100/70 blur-3xl" />

      <section className="relative w-full max-w-xl rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-2xl shadow-slate-900/8 backdrop-blur sm:p-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-sky-950 text-white shadow-lg shadow-sky-950/20">
            <ClipboardCheck className="size-6" aria-hidden="true" />
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">Umfrage</span>
        </div>

        <div className="flex gap-5">
          <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <CalendarX2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-sky-800 uppercase">Nicht verfügbar</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight tracking-tight text-slate-950 sm:text-5xl">Diese Umfrage ist geschlossen.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-600">Der Befragungszeitraum ist beendet oder dieser Link ist nicht mehr gültig. Es können keine weiteren Antworten abgegeben werden.</p>
          </div>
        </div>

        <div className="mt-10 flex items-start gap-3 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
          <p>Ihre bisherigen Antworten bleiben geschützt. Bei Fragen wenden Sie sich bitte direkt an die Klinik, die Sie eingeladen hat.</p>
        </div>
      </section>
    </main>
  );
}
