import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Boutons Tamurt Market : pilules douces, sans bordure épaisse. Le bouton principal est un aplat
 * miel avec texte encre (contraste > 10:1) et une ombre chaude qui le détache sur fond clair ;
 * il se soulève légèrement au survol. Les animations s'arrêtent si l'utilisateur limite les mouvements.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-[15px] font-semibold transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_rgba(205,120,0,0.75)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_10px_24px_-10px_rgba(205,120,0,0.85)]",
        accent: "bg-accent text-accent-foreground shadow-[0_6px_18px_-8px_rgba(173,80,44,0.7)] hover:-translate-y-0.5 hover:bg-accent-hover",
        /** Teinte miel douce, texte ocre : action secondaire sans alourdir l'écran. */
        secondary: "bg-primary-soft text-primary-soft-foreground hover:bg-[color-mix(in_srgb,var(--primary-soft),var(--primary)_18%)]",
        /** Sur le bandeau miel : aplat encre, texte miel vif. */
        inverse: "bg-brand-ink text-brand-vif shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--brand-ink),white_14%)]",
        outline: "border border-border bg-card text-foreground shadow-sm hover:border-border-strong hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "destructive-outline": "border border-destructive/40 text-destructive hover:bg-destructive-soft",
        link: "h-auto px-0 text-primary-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px]",
        md: "h-10 px-5",
        lg: "h-12 px-7 text-[16px]",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}
