import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-bold transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Aplat miel, texte encre, liseré ocre : le bouton se détache même sur fond clair. */
        primary: "border-[1.5px] border-primary-text bg-primary text-primary-foreground hover:bg-primary-hover",
        accent: "bg-accent text-accent-foreground hover:bg-accent-hover",
        /** Contour ocre sur fond transparent, teinte miel au survol. */
        secondary: "border-[1.5px] border-primary-text text-primary-text hover:bg-primary-soft",
        /** Sur le bandeau miel : aplat encre, texte miel vif. */
        inverse: "bg-brand-ink text-brand-vif hover:bg-[color-mix(in_srgb,var(--brand-ink),white_14%)]",
        outline: "border-[1.5px] border-border-strong bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "destructive-outline": "border border-destructive/40 text-destructive hover:bg-destructive-soft",
        link: "h-auto px-0 text-primary-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-[13px]",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-[17px]",
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
