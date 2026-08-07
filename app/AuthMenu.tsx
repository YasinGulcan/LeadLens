import Link from "next/link";

// Button component'i sadece <button> render ediyor; burada gerçek navigasyon
// (<a>) gerekiyor, bir <a> içine <button> koymak geçersiz HTML iç içeliği
// olurdu. Bu yüzden Button'ın primary/secondary sınıfları burada birebir
// kopyalanıp doğrudan Link'e uygulanıyor (bkz. components/ui/Button.tsx).
const BASE = "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors";
const SECONDARY = "border border-border bg-surface text-foreground hover:bg-surface-hover";
const PRIMARY = "bg-accent text-white hover:bg-accent-hover";

/** Header'daki "Giriş Yap"/"Kayıt Ol" — artık dropdown açmıyor, ayrı tam sayfalara (/login, /signup) yönlendiriyor. */
export function AuthMenu() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className={`${BASE} ${SECONDARY}`}>
        Giriş Yap
      </Link>
      <Link href="/signup" className={`${BASE} ${PRIMARY}`}>
        Kayıt Ol
      </Link>
    </div>
  );
}
