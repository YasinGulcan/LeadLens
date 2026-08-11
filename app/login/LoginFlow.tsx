"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { OtpCodeStep, type OtpActionResult } from "../OtpCodeStep";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "forgot-email" | "forgot-code">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetEmail, setResetEmail] = useState("");

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

  async function handleResetEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(resetEmail)) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu.");
      setStep("forgot-code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  async function handleResetVerify(code: string): Promise<OtpActionResult> {
    const res = await fetch("/api/auth/password-reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail, code }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    router.push(data.redirect ?? "/set-password");
    router.refresh();
    return { ok: true };
  }

  async function handleResetResend(): Promise<OtpActionResult> {
    const res = await fetch("/api/auth/resend-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail, purpose: "password_reset" }),
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.error };
  }

  if (step === "forgot-code") {
    return (
      <OtpCodeStep
        email={resetEmail}
        onVerify={handleResetVerify}
        onResend={handleResetResend}
        onBack={() => setStep("forgot-email")}
        verifyLabel="Doğrula"
      />
    );
  }

  if (step === "forgot-email") {
    return (
      <>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Şifrenizi sıfırlayın</h1>
          <p className="mt-2 text-sm text-muted-foreground">E-postanıza bir sıfırlama kodu gönderelim</p>
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
            {pending ? "Gönderiliyor..." : "Sıfırlama Kodu Gönder"}
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
