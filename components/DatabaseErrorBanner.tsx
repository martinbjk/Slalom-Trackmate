export function DatabaseErrorBanner({ error }: { error: string }) {
  return (
    <div className="max-w-xl rounded border border-signal-red bg-signal-red/10 p-4">
      <p className="mb-1 font-semibold text-signal-red">Kunde inte starta den lokala databasen</p>
      <p className="mb-2 text-sm text-foreground/80">
        Appen kunde inte initiera lagringen i den här webbläsaren. Detta händer oftast i äldre webbläsare
        (t.ex. Safari på iOS 15 eller äldre) som saknar stöd för vissa funktioner appen behöver
        (WebAssembly/IndexedDB). Prova en nyare enhet eller webbläsare (Chrome/Edge rekommenderas).
      </p>
      <p className="rounded bg-black/5 p-2 font-mono text-xs text-foreground/60">{error}</p>
    </div>
  );
}
