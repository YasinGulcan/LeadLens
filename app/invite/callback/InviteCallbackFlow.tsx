"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * `/dashboard/team`'deki davet linkinin indiği yer. Supabase'in "Invite user"
 * şablonu şu an özelleştirilemiyor (bkz. PROJECT_PLAN.md — custom SMTP
 * kurulana kadar Dashboard'da subject/body alanları kilitli), o yüzden
 * varsayılan `{{ .ConfirmationURL }}` linkini kullanmak zorundayız. O link
 * Supabase'in kendi `/verify` uç noktasına gidip oradan buraya oturum
 * bilgisini `#access_token=...&refresh_token=...` şeklinde URL fragment'ında
 * (sunucunun hiç göremeyeceği kısım) ekleyerek yönlendiriyor — bu yüzden
 * doğrulama sunucuda değil, burada (tarayıcıda) fragment okunup sunucuya
 * POST edilerek yapılıyor.
 */
export function InviteCallbackFlow() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) {
        setError(decodeURIComponent(hashError.replace(/\+/g, " ")));
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (!accessToken || !refreshToken) {
        setError("Davet linki geçersiz ya da süresi dolmuş, tekrar davet isteyin.");
        return;
      }

      try {
        const res = await fetch("/api/auth/invite/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Davet doğrulanamadı.");
        router.replace(data.redirect ?? "/confirm-join");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Davet doğrulanamadı.");
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-foreground">Davet doğrulanamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-lg font-semibold text-foreground">Davetiniz doğrulanıyor…</h1>
      <p className="mt-2 text-sm text-muted-foreground">Birkaç saniye sürebilir.</p>
    </div>
  );
}
