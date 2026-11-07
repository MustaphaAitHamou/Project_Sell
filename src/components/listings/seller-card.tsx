import { BadgeCheck, CalendarDays, Package, Store } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Card } from "@/components/ui/misc";
import { Rating } from "@/components/ui/rating";
import { Link } from "@/i18n/navigation";
import { avatarUrl } from "@/lib/utils";

export async function SellerCard({
  seller,
}: {
  seller: {
    id: string;
    createdAt: Date;
    profile: { handle: string; displayName: string; avatarKey: string | null; cityName: string | null; sellerType: "INDIVIDUAL" | "BUSINESS"; ratingSum: number; ratingCount: number; salesCount: number; identityVerified: boolean } | null;
  };
}) {
  const [t, format] = await Promise.all([getTranslations("listing"), getFormatter()]);
  const p = seller.profile;
  if (!p) return null;
  return (
    <Card className="grid gap-4 p-4">
      <Link href={`/vendeur/${p.handle}`} className="flex items-center gap-3 rounded-lg hover:opacity-90">
        <Avatar name={p.displayName} src={p.avatarKey ? avatarUrl(seller.id, p.avatarKey) : null} size={52} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.displayName}</p>
          {p.ratingCount > 0 ? <Rating sum={p.ratingSum} count={p.ratingCount} label={`Note moyenne ${(p.ratingSum / p.ratingCount).toFixed(1)} sur 5`} /> : <p className="text-sm text-muted-foreground">{t("noReviews")}</p>}
        </div>
      </Link>
      <div className="flex flex-wrap gap-1.5">
        {p.sellerType === "BUSINESS" ? (
          <Badge tone="info">
            <Store /> {t("proSeller")}
          </Badge>
        ) : null}
        {p.identityVerified ? (
          <Badge tone="success">
            <BadgeCheck /> {t("verifiedSeller")}
          </Badge>
        ) : null}
      </div>
      <ul className="grid gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Package className="size-4" aria-hidden /> {t("salesCount", { count: p.salesCount })}
        </li>
        <li className="flex items-center gap-2">
          <CalendarDays className="size-4" aria-hidden /> {t("memberSince", { date: format.dateTime(seller.createdAt, { month: "long", year: "numeric" }) })}
        </li>
      </ul>
    </Card>
  );
}
