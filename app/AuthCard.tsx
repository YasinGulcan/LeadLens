import Link from "next/link";
import { Card } from "@/components/ui";
import { GoogleButton } from "./GoogleButton";

/** `/login` ve `/signup`'ın paylaştığı tam sayfa, markalı kart — tek fark başlık/alt metin/alt link. */
export function AuthCard({
  title,
  description,
  footerText,
  footerLinkText,
  footerHref,
}: {
  title: string;
  description: string;
  footerText: string;
  footerLinkText: string;
  footerHref: string;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <Link href="/" className="mb-8 text-lg font-bold text-foreground">
        LeadLens
      </Link>

      <Card className="w-full max-w-md p-8 shadow-2xl sm:p-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>

        <GoogleButton className="mt-8 w-full" />

        <div className="mt-8 border-t border-border" />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {footerText}{" "}
          <Link href={footerHref} className="font-medium text-accent hover:underline">
            {footerLinkText}
          </Link>
        </p>
      </Card>

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
