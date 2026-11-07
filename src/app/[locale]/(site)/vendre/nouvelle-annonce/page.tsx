import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { ListingWizard } from "@/features/listings/listing-wizard";
import { getWizardData } from "@/features/listings/wizard-data";
import { requireUserPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Nouvelle annonce", robots: { index: false } };

export default async function NewListingPage() {
  const user = await requireUserPage("/vendre/nouvelle-annonce");
  const data = await getWizardData(user);
  return (
    <div className="container-page grid max-w-3xl gap-6 py-6 md:py-10">
      <PageHeader title="Vendre un article" description="Cinq étapes, quelques minutes. Vous pouvez enregistrer un brouillon à tout moment." />
      <ListingWizard
        mode="create"
        listingId={null}
        initial={{
          title: "",
          description: "",
          categoryId: "",
          brandName: "",
          condition: null,
          attributes: {},
          price: "",
          quantity: 1,
          countryCode: data.defaultCountry,
          regionId: user.profile?.countryCode === data.defaultCountry ? (user.profile?.regionId ?? "") : "",
          cityId: null,
          locality: "",
          deliveryMethods: ["HAND_DELIVERY"],
          parcelSize: null,
          weightGrams: null,
          acceptsCrossBorder: false,
          imageIds: [],
          images: [],
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
