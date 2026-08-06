"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "./useConfirm";
import { Card, Button } from "@/components/ui";

interface SavedPrompt {
  id: string;
  name: string;
  promptText: string;
  createdAt: string;
}

export function PromptForm({
  initialCustomPrompt,
  defaultPrompt,
  savedPrompts,
}: {
  initialCustomPrompt: string | null;
  defaultPrompt: string;
  savedPrompts: SavedPrompt[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [value, setValue] = useState(initialCustomPrompt ?? defaultPrompt);
  const [usingCustom, setUsingCustom] = useState(!!initialCustomPrompt);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate(nextValue: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customSystemPrompt: nextValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setUsingCustom(!!nextValue.trim());
      setMessage(nextValue.trim() ? "Kaydedildi." : "Varsayılana sıfırlandı.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  function handleReset() {
    setValue(defaultPrompt);
    activate("");
  }

  async function saveAs() {
    const name = newName.trim();
    if (!name || !value.trim()) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/prompt/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, promptText: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setNewName("");
      setMessage(`"${name}" kütüphaneye eklendi.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  function loadSavedPrompt(entry: SavedPrompt) {
    // Doğrudan aktive etmiyor — kullanıcı önce metni görüp isterse düzenlesin,
    // sonra "Kaydet"e bassın. Yanlışlıkla farklı bir promptu hemen uygulamak istemiyoruz.
    setValue(entry.promptText);
    setMessage(`"${entry.name}" yüklendi — uygulamak için Kaydet'e basın.`);
    setError(null);
  }

  async function deleteSaved(entry: SavedPrompt) {
    if (!(await confirm(`"${entry.name}" kütüphaneden silinsin mi?`, { danger: true }))) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/prompt/library/${entry.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Lead analiz asistanının (Claude) her yeni lead&apos;i değerlendirirken kullandığı ana talimat metni. Ürün
        önerisinin yapısı (alanlar) sabit kalır — burada değiştirdiğiniz, asistanın nasıl düşüneceği/hangi
        üsluba/önceliklere dikkat edeceğidir.{" "}
        <strong className="text-foreground">Şu an {usingCustom ? "kendi özel promptunuz" : "varsayılan prompt"}</strong> kullanılıyor.
      </p>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={16}
        spellCheck={false}
        className="w-full rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-foreground focus:border-accent focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={pending} onClick={() => activate(value)}>
          {pending ? "İşleniyor..." : "Kaydet"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={handleReset}>
          Varsayılana Sıfırla
        </Button>
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs text-muted-foreground">Mevcut aktif prompta dokunmadan, bu metni isimlendirip kütüphanenize ekleyin:</span>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="örn. Agresif Satış Üslubu"
          maxLength={60}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
        <Button variant="secondary" disabled={pending || !newName.trim() || !value.trim()} onClick={saveAs}>
          Farklı Kaydet
        </Button>
      </Card>

      {(message || error) && (
        <p className={`text-xs ${error ? "text-red-500 dark:text-red-400" : "text-emerald-500 dark:text-emerald-400"}`}>{error ?? message}</p>
      )}

      {savedPrompts.length > 0 && (
        <Card className="overflow-hidden">
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Kayıtlı Promptlarım</p>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {savedPrompts.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground" title={entry.name}>
                    {entry.name}
                  </p>
                  <p className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString("tr-TR")}</p>
                  <p className="mt-0.5 truncate text-muted-foreground" title={entry.promptText}>
                    {entry.promptText}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => loadSavedPrompt(entry)}>
                    Kullan
                  </Button>
                  <Button variant="danger" size="sm" disabled={pending} onClick={() => deleteSaved(entry)}>
                    Sil
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {dialog}
    </div>
  );
}
