"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 60;

export function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "forgot-email" | "forgot-sent">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetEmail, setResetEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "forgot-sent" || resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email) || !password) {
      setError("Geçerli bir e-posta ve şifre girin.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu.");
      router.push(data.redirect ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  async function sendResetLink(targetEmail: string) {
    const res = await fetch("/api/auth/password-reset/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu.");
  }

  async function handleResetEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(resetEmail)) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await sendResetLink(resetEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setStep("forgot-sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    setResendMessage(null);
    setError(null);
    try {
      await sendResetLink(resetEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendMessage("Bağlantı tekrar gönderildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    }
  }

  if (step === "forgot-sent") {
    return (
      <>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">E-postanızı kontrol edin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong className="text-foreground">{resetEmail}</strong> adresine bir şifre sıfırlama bağlantısı
            gönderdik. Gelen kutunuzdaki bağlantıya tıklayıp devam edin.
          </p>
        </div>

        {error && <p className="mt-4 text-center text-sm text-red-500 dark:text-red-400">{error}</p>}
        {resendMessage && <p className="mt-4 text-center text-sm text-emerald-500 dark:text-emerald-400">{resendMessage}</p>}

        <div className="mt-8 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep("forgot-email")}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            ‹ Bilgileri düzenle
          </button>
          {resendCooldown > 0 ? (
            <span className="text-muted-foreground">Tekrar gönder ({resendCooldown}s)</span>
          ) : (
            <button type="button" onClick={handleResend} className="font-medium text-accent hover:underline">
              Bağlantıyı tekrar gönder
            </button>
          )}
        </div>
      </>
    );
  }

  if (step === "forgot-email") {
    return (
      <>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Şifrenizi sıfırlayın</h1>
          <p className="mt-2 text-sm text-muted-foreground">E-postanıza bir sıfırlama bağlantısı gönderelim</p>
        </div>

        <form onSubmit={handleResetEmailSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">E-posta</label>
            <input
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              type="email"
              autoComplete="email"
              autoFocus
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={pending}>
            {pending ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <button type="button" onClick={() => setStep("login")} className="text-muted-foreground hover:text-foreground hover:underline">
            ‹ Girişe dön
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Tekrar hoş geldiniz</h1>
        <p className="mt-2 text-sm text-muted-foreground">E-postanızla saniyeler içinde giriş yapın</p>
      </div>

      <form onSubmit={handleLoginSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">E-posta</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            autoFocus
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Şifre</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Giriş yapılıyor..." : "Giriş Yap"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setResetEmail(email);
            setStep("forgot-email");
          }}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Şifremi Unuttum
        </button>
      </p>

      <div className="mt-8 border-t border-border" />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Hesabınız yok mu?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Kayıt olun
        </Link>
      </p>
    </>
  );
}
