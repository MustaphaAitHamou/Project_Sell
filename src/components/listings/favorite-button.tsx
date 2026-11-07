"use client";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/features/favorites/actions";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  listingId,
  initial,
  signedIn,
  variant = "overlay",
  className,
}: {
  listingId: string;
  initial: boolean;
  signedIn: boolean;
  variant?: "overlay" | "button";
  className?: string;
}) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [favorited, setFavorited] = useOptimistic(initial);
  const label = favorited ? t("removeFavorite") : t("addFavorite");

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push(`/connexion?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    start(async () => {
      setFavorited(!favorited);
      const res = await toggleFavoriteAction({ listingId });
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.favorited ? t("favoriteAdded") : t("favoriteRemoved"));
      router.refresh();
    });
  };

  if (variant === "button")
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={favorited}
        className={cn("inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-card px-4 text-sm font-semibold hover:bg-muted", className)}
      >
        <Heart className={cn("size-4", favorited && "fill-accent text-accent")} aria-hidden />
        {label}
      </button>
    );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={cn("grid size-9 place-items-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur transition-transform hover:scale-105", className)}
    >
      <Heart className={cn("size-[18px]", favorited && "fill-accent text-accent")} aria-hidden />
    </button>
  );
}
