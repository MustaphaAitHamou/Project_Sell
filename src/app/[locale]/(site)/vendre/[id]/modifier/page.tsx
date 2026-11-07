import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { Alert, PageHeader } from "@/components/ui/misc";
import { ListingWizard } from "@/features/listings/listing-wizard";
import { getWizardData } from "@/features/listings/wizard-data";
import { minorToDecimalString } from "@/lib/domain/money";
import { imageUrl } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { getListingForEdit } from "@/server/services/listings";

export const metadata: Metadata = { title: "Modifier l'annonce", robots: { index: false } };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUserPage(`/vendre/${id}/modifier`);
  const listing = await getListingForEdit(user, id).catch(() => null);
  if (!listing) notFound();
  const data = await getWizardData(user);
  return (
    <div className="container-page grid max-w-3xl gap-6 py-6 md:py-10">
      <PageHeader title="Modifier l'annonce" description={listing.title} actions={<ListingStatusBadge status={listing.status} />} />
      {listing.moderationNote ? <Alert tone="warning" title="Note de la modération">{listing.moderationNote}</Alert> : null}
      {listing.status === "ACTIVE" ? <Alert tone="info">Si vous modifiez le titre, la description, la catégorie ou les photos d&apos;une annonce soumise à vérification, elle repassera en vérification.</Alert> : null}
      <ListingWizard
        mode="edit"
        listingId={listing.id}
        version={listing.version}
        status={listing.status}
        initial={{
          title: listing.title,
          description: listing.description,
          categoryId: listing.categoryId,
          brandName: listing.brandName ?? "",
          condition: listing.condition,
          attributes: (listing.attributes ?? {}) as Record<string, string | number | boolean>,
          price: minorToDecimalString(listing.priceAmount, listing.currency).replace(".", ",").replace(/,00$/, ""),
          quantity: listing.quantity,
          countryCode: listing.countryCode,
          regionId: listing.regionId,
          cityId: listing.cityId,
          locality: listing.locality ?? "",
          deliveryMethods: listing.deliveryMethods,
          parcelSize: listing.parcelSize,
          weightGrams: listing.weightGrams,
          acceptsCrossBorder: listing.acceptsCrossBorder,
          imageIds: listing.images.map((i) => i.id),
          images: listing.images.map((i) => ({ id: i.id, url: imageUrl(i.id, "thumb"), blurDataUrl: i.blurDataUrl })),
        }}
        categories={data.categories}
        attributes={data.attributes}
        countries={data.countries}
        regionsByCountry={data.regionsByCountry}
        citiesByRegion={data.citiesByRegion}
        brands={data.brands}
        isBusiness={user.profile?.sellerType === "BUSINESS"}
        buyerFeeRateBps={data.buyerFeeRateBps}
        transportEnabled={data.transportEnabled}
      />
    </div>
  );
}
