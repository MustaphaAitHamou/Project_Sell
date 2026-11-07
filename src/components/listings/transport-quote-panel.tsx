"use client";
import { AlertTriangle, BadgeCheck, CalendarDays, Plane, Ship, Truck, WifiOff } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert, Badge } from "@/components/ui/misc";
import { getTransportQuotesAction } from "@/features/transport/actions";
import { formatMoney } from "@/lib/domain/money";

type Result = Awaited<ReturnType<typeof getTransportQuotesAction>>;
const COUNTRY_NAMES: Record<string, string> = { FR: "France", DZ: "Algérie" };
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Devis Tamurt Transport : indicatifs tant que le corridor et la conformité ne sont pas validés. */
export function TransportQuotePanel({ listingId, originCountry }: { listingId: string; originCountry: string; signedIn: boolean }) {
  const [destination, setDestination] = useState(originCountry === "FR" ? "DZ" : "FR");
  const [city, setCity] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setResult(await getTransportQuotesAction({ listingId, destinationCountry: destination as "FR" | "DZ", destinationCity: city || undefined }));
    });

  const data = result?.ok ? result.data : null;
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Truck className="size-5" aria-hidden />
        </span>
        <div className="grid gap-0.5">
          <p className="font-semibold">Livraison {COUNTRY_NAMES[originCountry] === "France" ? "vers l'Algérie" : "vers la France"} avec Tamurt Transport</p>
          <p className="text-sm text-muted-foreground">Estimation par un voyageur effectuant déjà le trajet. Service en préparation : aucune réservation réelle n'est possible à ce jour.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="tq-country">Pays de livraison</Label>
          <Select id="tq-country" value={destination} onChange={(e) => setDestination(e.target.value)}>
            {["FR", "DZ"].map((c) => (
              <option key={c} value={c}>
                {COUNTRY_NAMES[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tq-city">Ville (facultatif)</Label>
          <Input id="tq-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder={destination === "DZ" ? "ex. Béjaïa" : "ex. Marseille"} maxLength={120} />
        </div>
        <Button type="button" variant="secondary" onClick={run} loading={pending}>
          Estimer le transport
        </Button>
      </div>

      {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
      {data?.status === "disabled" ? <Alert tone="info">{data.message}</Alert> : null}
      {data?.status === "blocked" ? (
        <Alert tone="danger" title="Envoi non autorisé">
          {data.message}
        </Alert>
      ) : null}
      {data?.status === "unavailable" ? (
        <Alert tone="warning" title="Tamurt Transport indisponible">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="size-4" aria-hidden /> {data.message}
          </span>
        </Alert>
      ) : null}
      {data?.status === "ok" ? (
        <div className="grid gap-3">
          {data.simulated ? (
            <Badge tone="warning" className="w-fit">
              Simulation — trajets et voyageurs fictifs
            </Badge>
          ) : null}
          {data.quotes.length === 0 ? <p className="text-sm text-muted-foreground">Aucun trajet compatible pour le moment.</p> : null}
          <ul className="grid gap-2">
            {data.quotes.map((q) => (
              <li key={q.quoteId} className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="grid gap-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {q.mode === "FERRY" ? <Ship className="size-4" aria-hidden /> : <Plane className="size-4" aria-hidden />}
                    {q.originCity} → {q.destinationCity}
                    {q.travelerVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                        <BadgeCheck className="size-3.5" aria-hidden /> voyageur vérifié
                      </span>
                    ) : null}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="size-3.5" aria-hidden /> Départ le {fmtDate(q.departureDate)} · livraison estimée du {fmtDate(q.estimatedFrom)} au {fmtDate(q.estimatedTo)}
                  </p>
                  {q.notes.length ? <p className="text-xs text-muted-foreground">{q.notes.join(" ")}</p> : null}
                </div>
                <div className="text-end">
                  <p className="text-lg font-bold tabular-nums">{formatMoney(q.amount, q.currency)}</p>
                  <p className="text-xs text-muted-foreground">prix du transport, commission Transport incluse</p>
                </div>
              </li>
            ))}
          </ul>
          {data.blockers.length ? (
            <div className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Achat avec Tamurt Transport non disponible pour le moment</p>
                <ul className="list-disc ps-4">
                  {data.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">Les droits et taxes d&apos;importation éventuels ne sont pas inclus et peuvent être exigés à la livraison.</p>
              </div>
            </div>
          ) : null}
          {data.notices.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
