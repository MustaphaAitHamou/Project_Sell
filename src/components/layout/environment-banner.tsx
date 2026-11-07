import { FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Bandeau permanent tant que des simulateurs ou des données fictives sont actifs. */
export async function EnvironmentBanner() {
  const t = await getTranslations("env");
  return (
    <div className="bg-warning-soft text-warning-soft-foreground">
      <p className="container-page flex items-center gap-2 py-1.5 text-xs font-medium">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        <span className="line-clamp-2 sm:line-clamp-1">{t("banner")}</span>
        <Link href="/comment-ca-marche#etat-du-service" className="ms-auto shrink-0 underline">
          {t("details")}
        </Link>
      </p>
    </div>
  );
}
