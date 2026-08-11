"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const RESEND_COOLDOWN_SECONDS = 60;

export interface OtpActionResult {
  ok: boolean;
  error?: string;
}

/** `/signup` ve `/login`'in ortak 2. adımı: 6 haneli kod girişi + "tekrar gönder" (60sn cooldown). Doğrulama/tekrar-gönderme mantığı çağırana bırakılır. */
export function OtpCodeStep({
  email,
  onVerify,
  onResend,
  onBack,
  verifyLabel = "Doğrula",
}: {
  email: string;
  onVerify: (code: string) => Promise<OtpActionResult>;
  onResend: () => Promise<OtpActionResult>;
  onBack: () => void;
  verifyLabel?: string;
}) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onVerify(code);
    setPending(false);
    if (!result.ok) setError(result.error ?? "Kod doğrulanamadı.");
  }

  async function handleResend() {
    setError(null);
    const result = await onResend();
    if (result.ok) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode("");
    } else {
      setError(result.error ?? "Kod gönderilemedi.");
    }
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">E-postanızı doğrulayın</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="text-foreground">{email}</strong> adresine 6 haneli bir kod gönderdik.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          autoFocus
          placeholder="••••••"
          className="w-full rounded-md border border-border bg-surface px-3 py-3 text-center text-2xl tracking-[0.5em] text-foreground focus:border-accent focus:outline-none"
        />

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={pending || code.length !== 6}>
          {pending ? "Doğrulanıyor..." : verifyLabel}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground hover:underline">
          ‹ Bilgileri düzenle
        </button>
        {cooldown > 0 ? (
          <span className="text-muted-foreground">Tekrar gönder ({cooldown}s)</span>
        ) : (
          <button type="button" onClick={handleResend} className="font-medium text-accent hover:underline">
            Kodu tekrar gönder
          </button>
        )}
      </div>
    </>
  );
}
