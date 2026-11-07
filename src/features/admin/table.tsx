import { cn } from "@/lib/utils";

/** Tableau d'administration accessible (en-têtes, défilement horizontal sur mobile). */
export function AdminTable({ head, rows, empty = "Aucun élément.", className }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty?: string; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-subtle text-start text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2.5 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-8 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-border align-top hover:bg-subtle/60">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
