import { AlertTriangle, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/misc";
import { AddressForm } from "@/features/orders/address-form";
import { CheckoutOption, PlaceOrderButton } from "@/features/orders/checkout-client";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { imageUrl } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { getActiveCountries, getRegions } from "@/server/services/catalog";
import { BLOCK_REASON_LABELS } from "@/server/services/eligibility";
import { getCheckoutPreview } from "@/server/services/orders/checkout";

export const metadata: Metadata = { title: "Finaliser l'achat", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; adresse?: string; devis?: string }> };

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUserPage(`/commander/${id}`);
  const t = await getTranslations();
  const mode = ["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"].includes(sp.mode ?? "") ? (sp.mode as "HAND_DELIVERY") : null;
  const preview = await getCheckoutPreview(user, id, { deliveryMethod: mode, addressId: sp.adresse?.match(/^[0-9a-f-]{36}$/) ? sp.adresse : null, transportQuoteId: sp.devis?.match(/^[0-9a-f-]{36}$/) ? sp.devis : null }).catch(() => null);
  if (!preview) notFound();
  const { listing, eligibility, pricing } = preview;
  const countries = await getActiveCountries();
  const regionsByCountry = Object.fromEntries(await Promise.all(countries.map(async (c) => [c.code, await getRegions(c.code)] as const)));
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { mode: preview.method, adresse: preview.selectedAddressId, devis: sp.devis ?? null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/commander/${id}?${p.toString()}`;
  };
  const canPlace = eligibility.purchasable && !!pricing && (!preview.requiresAddress || !!preview.selectedAddressId);
  return (
    <div className="container-page grid max-w-5xl gap-6 py-6 md:py-10">
      <PageHeader title="Finaliser l'achat" description="Vérifiez le mode de remise, l'adresse et le détail des montants avant de payer." />
      {listing.isDemo ? <Alert tone="warning">Article de démonstration fictif : le paiement est simulé, aucun débit réel.</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <div className="grid content-start gap-6">
          <Card className="flex items-center gap-4 p-4">
            <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">{listing.imageId ? <img src={imageUrl(listing.imageId, "thumb")} alt="" className="size-full object-cover" /> : null}</div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{listing.title}</p>
              <p className="text-sm text-muted-foreground">Vendu par {listing.sellerName}</p>
              <p className="font-bold">{formatMoney(listing.priceAmount, listing.currency)}</p>
            </div>
          </Card>

          {!eligibility.purchasable ? (
            <Alert tone="danger" title="Achat en ligne impossible pour cet article">
              <ul className="list-disc ps-4">
                {eligibility.reasons.map((r) => (
                  <li key={r}>{BLOCK_REASON_LABELS[r]}</li>
                ))}
              </ul>
              <p className="mt-1">
                Vous pouvez <Link href={listing.path}>revenir à l&apos;annonce</Link> et contacter le vendeur.
              </p>
            </Alert>
          ) : (
            <>
              <section className="grid gap-3" aria-labelledby="mode">
                <h2 id="mode" className="font-bold">
                  Mode de remise
                </h2>
                <div role="radiogroup" aria-labelledby="mode" className="grid gap-2">
                  {eligibility.methods
                    .filter((m) => listing.deliveryMethods.includes(m.method))
                    .map((m) => (
                      <div key={m.method} className={m.available ? "" : "opacity-60"}>
                        {m.available ? (
                          <CheckoutOption href={href({ mode: m.method })} selected={preview.method === m.method}>
                            <span className="font-semibold">{t(`delivery.${m.method}`)}</span>
                            <span className="text-muted-foreground">{t(`delivery.${m.method}_hint`)}</span>
                            {preview.method === m.method && preview.shipping && m.method !== "HAND_DELIVERY" ? (
                              <span className="font-medium">
                                {preview.shipping.serviceName} · {formatMoney(preview.shipping.amount, preview.shipping.currency)}
                                {preview.shipping.etaMin ? ` · ${preview.shipping.etaMin} à ${preview.shipping.etaMax} jours` : ""}
                                {preview.shipping.isSimulated ? <Badge tone="warning" className="ms-2">simulation</Badge> : null}
                              </span>
                            ) : null}
                          </CheckoutOption>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border p-3 text-sm">
                            <span className="font-semibold">{t(`delivery.${m.method}`)}</span> — <span className="text-muted-foreground">{m.reason === "TRANSPORT_DISABLED" ? "non activé" : m.reason === "COMPLIANCE" ? "non autorisé pour ce flux" : m.reason === "CROSS_BORDER_ONLY_TRANSPORT" ? "indisponible entre pays" : "indisponible"}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </section>

              {preview.requiresAddress ? (
                <section className="grid gap-3" aria-labelledby="addr">
                  <h2 id="addr" className="font-bold">
                    Adresse de livraison
                  </h2>
                  <p className="text-xs text-muted-foreground">Communiquée au vendeur (ou au transporteur) uniquement après confirmation du paiement.</p>
                  {preview.addresses.length ? (
                    <div role="radiogroup" aria-labelledby="addr" className="grid gap-2">
                      {preview.addresses.map((a) => (
                        <CheckoutOption key={a.id} href={href({ adresse: a.id })} selected={preview.selectedAddressId === a.id}>
                          <span className="flex items-center gap-1.5 font-semibold">
                            <MapPin className="size-4" aria-hidden /> {a.fullName}
                          </span>
                          <span className="text-muted-foreground">
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ""}, {a.postalCode} {a.city} ({a.countryCode})
                          </span>
                        </CheckoutOption>
                      ))}
                    </div>
                  ) : null}
                  <details className="rounded-xl border border-border p-4" open={preview.addresses.length === 0}>
                    <summary className="cursor-pointer text-sm font-semibold">Ajouter une adresse</summary>
                    <div className="mt-4">
                      <AddressForm countries={countries.map((c) => ({ code: c.code, name: c.name }))} regionsByCountry={regionsByCountry} defaultCountry={listing.countryCode} />
                    </div>
                  </details>
                </section>
              ) : preview.method === "HAND_DELIVERY" ? (
                <Alert tone="info" title="Remise en main propre">
                  Après paiement, convenez d&apos;un rendez-vous avec le vendeur via la messagerie, dans un lieu public. Lors de la remise, vérifiez l&apos;article puis communiquez votre code de remise au vendeur : il confirme ainsi l&apos;échange.
                </Alert>
              ) : null}
            </>
          )}
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-36">
          <Card className="grid gap-3 p-5 text-sm">
            <h2 className="text-base font-bold">Récapitulatif</h2>
            {pricing ? (
              <>
                <div className="flex justify-between">
                  <span>{t("pricing.items")}</span>
                  <span className="tabular-nums">{formatMoney(pricing.itemsSubtotal, pricing.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("pricing.buyerFee", { rate: `${pricing.buyerFeeRateBps / 100} %` })}</span>
                  <span className="tabular-nums">{formatMoney(pricing.buyerFee, pricing.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{preview.method === "HAND_DELIVERY" ? t("pricing.shippingNone") : t("pricing.shipping")}</span>
                  <span className="tabular-nums">{formatMoney(pricing.shippingAmount, pricing.currency)}</span>
                </div>
                {pricing.taxStatus !== "NONE" ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t(`pricing.tax.${pricing.taxStatus}`)}</span>
                    <span>—</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border pt-3 text-lg font-bold">
                  <span>{t("pricing.total")}</span>
                  <span className="tabular-nums" data-testid="checkout-total">
                    {formatMoney(pricing.totalAmount, pricing.currency)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t("pricing.feeExplanation")}</p>
                {preview.method === "TAMURT_TRANSPORT" ? <p className="text-xs text-muted-foreground">{t("pricing.transportExplanation")}</p> : null}
                <p className="text-xs text-muted-foreground">{t("pricing.currencyNote", { currency: pricing.currency })}</p>
              </>
            ) : preview.pricingError ? (
              <p className="flex gap-2 text-destructive">
                <AlertTriangle className="size-4 shrink-0" aria-hidden /> {preview.pricingError}
              </p>
            ) : (
              <p className="text-muted-foreground">Montants indisponibles.</p>
            )}
            {canPlace && preview.method ? (
              <PlaceOrderButton
                input={{ listingId: listing.id, deliveryMethod: preview.method, addressId: preview.selectedAddressId, transportQuoteId: sp.devis ?? null, idempotencyKey: crypto.randomUUID() }}
                label={`Payer ${formatMoney(pricing!.totalAmount, pricing!.currency)}`}
              />
            ) : null}
            {eligibility.paymentProvider === "sandbox" ? <p className="text-center text-xs font-medium text-warning-soft-foreground">Paiement simulé : aucun débit réel.</p> : null}
            <p className="text-center text-xs text-muted-foreground">
              En validant, vous acceptez les <Link href="/conditions" className="underline">conditions générales</Link> et la <Link href="/protection-acheteur" className="underline">politique de protection acheteur</Link>.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
