import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      primary: "bg-primary-soft text-primary-soft-foreground",
      accent: "bg-accent-soft text-accent-soft-foreground",
      success: "bg-success-soft text-success-soft-foreground",
      warning: "bg-warning-soft text-warning-soft-foreground",
      danger: "bg-destructive-soft text-destructive-soft-foreground",
      info: "bg-info-soft text-info-soft-foreground",
      outline: "border border-border-strong text-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-soft)]", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

const ALERT_ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle } as const;
const ALERT_TONES = {
  info: "border-info/25 bg-info-soft text-info-soft-foreground",
  success: "border-success/25 bg-success-soft text-success-soft-foreground",
  warning: "border-warning/30 bg-warning-soft text-warning-soft-foreground",
  danger: "border-destructive/25 bg-destructive-soft text-destructive-soft-foreground",
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  icon = true,
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  icon?: boolean;
}) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3.5 text-sm", ALERT_TONES[tone], className)}>
      {icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
      <div className="grid gap-1 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_a]:font-semibold [&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-card/60 px-6 py-12 text-center", className)}>
      {Icon ? (
        <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <Icon className="size-6" />
        </span>
      ) : null}
      <div className="grid max-w-md gap-1">
        <p className="font-semibold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-border", className)} />;
}

export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("grid gap-1 p-4", className)}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
