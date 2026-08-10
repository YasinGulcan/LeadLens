type CardProps = React.ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "section";
};

/** Panel genelindeki tüm kartların ortak yüzeyi — katmanlı koyu temanın "surface" seviyesi. Standart div prop'larını (onClick, role vb.) forward eder, tıklanabilir kart gibi kullanımlar için. */
export function Card({ children, className = "", as: As = "div", ...rest }: CardProps) {
  return (
    <As className={`rounded-xl border border-border bg-surface ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-sm font-semibold text-foreground ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-muted-foreground ${className}`}>{children}</p>;
}
