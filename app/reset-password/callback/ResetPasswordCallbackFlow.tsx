"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * `/login` → "Şifremi Unuttum"un indiği yer. Supabase'in "Reset Password"
 * şablonu (Invite user gibi) özelleştirilemiyor — bkz. PROJECT_PLAN.md,
 * custom SMTP kurulana kadar Dashboard'da subject/body kilitli — o yüzden
 * kod değil, varsayılan `{{ .ConfirmationURL }}` linkini kullanmak
 * zorundayız. O link Supabase'in kendi `/verify` uç noktasına gidip oturum
 * bilgisini buraya `#access_token=...&refresh_token=...` şeklinde URL
 * fragment'ında (sunucunun hiç göremeyeceği kısım) bırakarak yönlendiriyor
 * — bu yüzden doğrulama sunucuda değil, burada (tarayıcıda) fragment
 * okunup sunucuya POST edilerek yapılıyor (bkz. app/invite/callback ile
 * aynı desen).
 */
export function ResetPasswordCallbackFlow() {
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
        setError("Bağlantı geçersiz ya da süresi dolmuş, tekrar deneyin.");
        return;
      }

      try {
        const res = await fetch("/api/auth/password-reset/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Doğrulanamadı.");
        router.replace(data.redirect ?? "/set-password");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Doğrulanamadı.");
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-foreground">Bağlantı doğrulanamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-lg font-semibold text-foreground">Doğrulanıyor…</h1>
      <p className="mt-2 text-sm text-muted-foreground">Birkaç saniye sürebilir.</p>
    </div>
  );
}
