import Link from "next/link";
import { Card } from "@/components/ui";

/** `/login` ve `/signup`'ın paylaştığı tam sayfa, markalı kart kabuğu — içerik (form adımı) çağırana bırakılır. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <Link href="/" className="mb-8 text-lg font-bold text-foreground">
        LeadLens
      </Link>

      <Card className="w-full max-w-md p-8 shadow-2xl sm:p-10">{children}</Card>

      <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        Devam ederek{" "}
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          Gizlilik Politikası
        </Link>{" "}
        ve{" "}
        <Link href="/terms" className="hover:text-foreground hover:underline">
          Hizmet Şartları
        </Link>
        &apos;nı kabul etmiş olursunuz.
      </p>
    </main>
  );
}
