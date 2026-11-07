import { cn, initials } from "@/lib/utils";

const PALETTE = ["bg-primary-soft text-primary-soft-foreground", "bg-accent-soft text-accent-soft-foreground", "bg-info-soft text-info-soft-foreground", "bg-success-soft text-success-soft-foreground", "bg-warning-soft text-warning-soft-foreground"];

/** Avatar : photo si disponible, sinon initiales sur une teinte stable dérivée du nom. */
export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold", !src && PALETTE[hue], className)}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
      aria-hidden
    >
      {src ? <img src={src} alt="" width={size} height={size} className="size-full object-cover" loading="lazy" decoding="async" /> : initials(name) || "?"}
    </span>
  );
}
