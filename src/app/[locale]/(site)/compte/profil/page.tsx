import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/misc";
import { ProfileForm } from "@/features/profile/profile-form";
import { Link } from "@/i18n/navigation";
import { avatarUrl } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { getActiveCountries, getRegions } from "@/server/services/catalog";
import { getOwnProfile } from "@/server/services/profiles";

export const metadata: Metadata = { title: "Profil public" };

export default async function ProfilePage() {
  const user = await requireUserPage("/compte/profil");
  const [p, countries] = await Promise.all([getOwnProfile(user.id), getActiveCountries()]);
  const regionsByCountry = Object.fromEntries(await Promise.all(countries.map(async (c) => [c.code, await getRegions(c.code)] as const)));
  return (
    <>
      <PageHeader title="Profil public" description="Ces informations sont visibles par tous. Vos coordonnées restent privées." actions={<Link href={`/vendeur/${p.handle}`} className="text-sm font-semibold text-primary hover:underline">Voir mon profil</Link>} />
      <Card className="p-5">
        <ProfileForm
          initial={{ displayName: p.displayName, handle: p.handle, bio: p.bio ?? "", countryCode: p.countryCode ?? "FR", regionId: p.regionId ?? "", cityName: p.cityName ?? "" }}
          avatar={p.avatarKey ? avatarUrl(user.id, p.avatarKey) : null}
          countries={countries.map((c) => ({ code: c.code, name: c.name, regionLabel: c.regionLabel }))}
          regionsByCountry={regionsByCountry}
        />
      </Card>
    </>
  );
}
