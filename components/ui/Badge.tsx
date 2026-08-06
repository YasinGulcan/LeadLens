export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: "bg-zinc-500/10 text-muted-foreground",
  accent: "bg-accent/10 text-accent",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
};

/** Panel genelindeki tüm etiketler (durum, öncelik, skor kademesi) için tek badge bileşeni — sadece `variant` renk kararını verir. */
export function Badge({
  variant = "neutral",
  children,
  className = "",
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${VARIANT_CLASS[variant]} ${className}`}>
      {children}
    </span>
  );
}
