/** Panel genelindeki tüm kartların ortak yüzeyi — katmanlı koyu temanın "surface" seviyesi. */
export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return <As className={`rounded-xl border border-border bg-surface ${className}`}>{children}</As>;
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-sm font-semibold text-foreground ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-muted-foreground ${className}`}>{children}</p>;
}
