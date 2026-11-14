/**
 * Entonnoir en barres horizontales (une seule série : pas de légende, le titre la nomme).
 * Barres ≤ 24 px, extrémité arrondie de 4 px et base carrée, valeur en bout de barre dans
 * les couleurs de texte, info-bulle au survol et au focus clavier, tableau équivalent.
 */
export function FunnelChart({ title, steps, note }: { title: string; steps: { label: string; value: number | null }[]; note?: string }) {
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0));
  const fmt = new Intl.NumberFormat("fr-FR");
  const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
  return (
    <figure className="grid gap-3">
      <figcaption className="font-semibold">{title}</figcaption>
      <ol className="grid gap-2.5">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1]?.value : null;
          const rate = s.value !== null && prev ? s.value / prev : null;
          const width = s.value === null ? 0 : Math.max(s.value > 0 ? 1.5 : 0, (s.value / max) * 100);
          const desc = s.value === null ? `${s.label} : non mesuré` : `${s.label} : ${fmt.format(s.value)}${rate !== null ? `, soit ${pct.format(rate)} de l'étape précédente` : ""}`;
          return (
            <li key={s.label} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                {rate !== null ? <span className="text-xs text-muted-foreground tabular-nums">{pct.format(rate)} de l&apos;étape précédente</span> : null}
              </div>
              <div className="group relative flex items-center gap-2 outline-none" tabIndex={0} aria-label={desc}>
                <div className="h-5 min-w-0 flex-1">
                  {s.value === null ? (
                    <div className="h-5 rounded-e-[4px] border border-dashed border-border-strong" style={{ width: "100%" }} aria-hidden />
                  ) : (
                    <div className="h-5 rounded-e-[4px] bg-chart-1 transition-opacity group-hover:opacity-85 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring" style={{ width: `${width}%` }} aria-hidden />
                  )}
                </div>
                <span className="w-16 shrink-0 text-end text-sm font-semibold tabular-nums">{s.value === null ? "—" : fmt.format(s.value)}</span>
                <span role="tooltip" className="pointer-events-none absolute -top-9 left-0 z-10 hidden rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                  {desc}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-primary-text">Voir le tableau</summary>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-start text-xs text-muted-foreground">
              <th scope="col" className="py-1 text-start font-medium">
                Étape
              </th>
              <th scope="col" className="py-1 text-end font-medium">
                Membres
              </th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.label} className="border-t border-border">
                <td className="py-1">{s.label}</td>
                <td className="py-1 text-end tabular-nums">{s.value === null ? "non mesuré" : fmt.format(s.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
