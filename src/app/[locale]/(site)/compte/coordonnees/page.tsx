import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/misc";
import { ContactForm } from "@/features/account/client";
import { AddressForm } from "@/features/orders/address-form";
import { AddressList } from "@/features/orders/address-list";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { listAddresses } from "@/server/services/addresses";
import { getActiveCountries, getRegions } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Coordonnées privées" };

export default async function ContactPage() {
  const user = await requireUserPage("/compte/coordonnees");
  const [contact, addresses, countries] = await Promise.all([db.userContact.findUnique({ where: { userId: user.id } }), listAddresses(user), getActiveCountries()]);
  const regionsByCountry = Object.fromEntries(await Promise.all(countries.map(async (c) => [c.code, await getRegions(c.code)] as const)));
  return (
    <>
      <PageHeader title="Coordonnées privées" description="Jamais affichées publiquement. Votre adresse n'est transmise au vendeur ou au transporteur qu'après paiement d'une commande." />
      <Card className="grid gap-4 p-5">
        <h2 className="font-bold">Identité et téléphone</h2>
        <ContactForm initial={{ firstName: contact?.firstName ?? "", lastName: contact?.lastName ?? "", phone: contact?.phone ?? "" }} />
      </Card>
      <Card className="grid gap-4 p-5">
        <h2 className="font-bold">Adresses de livraison</h2>
        <AddressList addresses={addresses.map((a) => ({ id: a.id, text: `${a.fullName} — ${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.postalCode ?? ""} ${a.city} (${a.countryCode})`, isDefault: a.isDefault }))} />
        <details className="rounded-xl border border-border p-4" open={addresses.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold">Ajouter une adresse</summary>
          <div className="mt-4">
            <AddressForm countries={countries.map((c) => ({ code: c.code, name: c.name }))} regionsByCountry={regionsByCountry} defaultCountry={user.profile?.countryCode ?? "FR"} />
          </div>
        </details>
      </Card>
    </>
  );
}
