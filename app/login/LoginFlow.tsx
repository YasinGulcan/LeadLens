"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { OtpCodeStep, type OtpActionResult } from "../OtpCodeStep";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email)) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu.");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(code: string): Promise<OtpActionResult> {
    const res = await fetch("/api/auth/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    router.push(data.redirect ?? "/dashboard");
    router.refresh();
    return { ok: true };
  }

  async function handleResend(): Promise<OtpActionResult> {
    const res = await fetch("/api/auth/resend-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose: "login" }),
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.error };
  }

  if (step === "code") {
    return <OtpCodeStep email={email} onVerify={handleVerify} onResend={handleResend} onBack={() => setStep("form")} verifyLabel="Giriş Yap" />;
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Tekrar hoş geldiniz</h1>
        <p className="mt-2 text-sm text-muted-foreground">E-postanızla saniyeler içinde giriş yapın</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">E-posta</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoFocus
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Gönderiliyor..." : "Giriş Kodu Gönder"}
        </Button>
      </form>

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
