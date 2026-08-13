"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

const MIN_PASSWORD_LENGTH = 8;

/** Oturum açıkken kendi şifresini değiştirme — /set-password ile aynı uç noktayı (/api/auth/set-password) kullanır, sadece burada onboarding'e yönlendirme yapılmıyor. */
export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, passwordConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu.");
      setMessage("Şifreniz güncellendi.");
      setPassword("");
      setPasswordConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Yeni Şifre</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">En az {MIN_PASSWORD_LENGTH} karakter.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Yeni Şifre (Tekrar)</label>
        <input
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          type="password"
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor..." : "Şifreyi Güncelle"}
      </Button>
    </form>
  );
}
