import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={SearchX}
        title={t("notFoundTitle")}
        description={t("notFoundText")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/" className={buttonVariants()}>
              {t("backHome")}
            </Link>
            <Link href="/explorer" className={buttonVariants({ variant: "outline" })}>
              Explorer les annonces
            </Link>
          </div>
        }
      />
    </div>
  );
}
