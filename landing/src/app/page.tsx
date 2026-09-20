export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Clozer
      </p>
      <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl">
        Vos propositions commerciales, lues page par page.
      </h1>
      <p className="text-pretty text-lg text-muted-foreground">
        Le site arrive bientôt. En attendant, l&apos;application est
        accessible aux comptes existants.
      </p>
      <div>
        <a
          href="https://app.clozer.club"
          className="inline-flex items-center rounded-full border border-current px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
        >
          Ouvrir l&apos;application
        </a>
      </div>
    </main>
  );
}
