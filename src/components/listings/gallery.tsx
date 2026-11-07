"use client";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { cn, imageUrl } from "@/lib/utils";

type Img = { id: string; width: number; height: number; blurDataUrl: string | null };

/** Galerie : défilement par balayage sur mobile (scroll-snap), vignettes et flèches au clavier. */
export function Gallery({ images, title }: { images: Img[]; title: string }) {
  const t = useTranslations("listing");
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  if (images.length === 0)
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-border bg-muted text-muted-foreground">
        <ImageOff className="size-10" aria-hidden />
        <span className="sr-only">{t("noPhoto")}</span>
      </div>
    );

  const go = (i: number) => {
    const next = (i + images.length) % images.length;
    setIndex(next);
    const el = track.current?.children[next] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  return (
    <div className="grid gap-3" role="region" aria-roledescription="carrousel" aria-label={title}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
        <div
          ref={track}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index && i >= 0 && i < images.length) setIndex(Math.abs(i));
          }}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(index + 1);
            if (e.key === "ArrowLeft") go(index - 1);
          }}
        >
          {images.map((img, i) => (
            <div key={img.id} className="aspect-[4/3] w-full shrink-0 snap-start" aria-label={t("photoOf", { index: i + 1, total: images.length })} role="group">
              <img
                src={imageUrl(img.id, "large")}
                alt={i === 0 ? title : t("photoOf", { index: i + 1, total: images.length })}
                width={img.width}
                height={img.height}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                className="size-full object-contain"
                style={img.blurDataUrl ? { backgroundImage: `url(${img.blurDataUrl})`, backgroundSize: "cover" } : undefined}
              />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <>
            <button type="button" onClick={() => go(index - 1)} className="absolute start-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-md hover:bg-card sm:grid" aria-label="Photo précédente">
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </button>
            <button type="button" onClick={() => go(index + 1)} className="absolute end-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-md hover:bg-card sm:grid" aria-label="Photo suivante">
              <ChevronRight className="size-5 rtl:rotate-180" />
            </button>
            <span className="absolute end-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
              {index + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="scrollbar-none hidden gap-2 overflow-x-auto sm:flex">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => go(i)}
              aria-label={t("photoOf", { index: i + 1, total: images.length })}
              aria-current={i === index}
              className={cn("size-20 shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition-colors", i === index ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")}
            >
              <img src={imageUrl(img.id, "thumb")} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
