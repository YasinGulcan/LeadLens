"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "./useConfirm";

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
    <div className="mt-3 max-w-3xl space-y-3">
      <p className="text-xs text-neutral-500">
        Lead analiz asistanının (Claude) her yeni lead&apos;i değerlendirirken kullandığı ana talimat metni. Ürün
        önerisinin yapısı (alanlar) sabit kalır — burada değiştirdiğiniz, asistanın nasıl düşüneceği/hangi
        üsluba/önceliklere dikkat edeceğidir.{" "}
        <strong>Şu an {usingCustom ? "kendi özel promptunuz" : "varsayılan prompt"}</strong> kullanılıyor.
      </p>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={16}
        spellCheck={false}
        className="w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs leading-relaxed dark:border-neutral-700 dark:bg-neutral-900"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => activate(value)}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "İşleniyor..." : "Kaydet"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleReset}
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Varsayılana Sıfırla
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <span className="text-xs text-neutral-500">Mevcut aktif prompta dokunmadan, bu metni isimlendirip kütüphanenize ekleyin:</span>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="örn. Agresif Satış Üslubu"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="button"
          disabled={pending || !newName.trim() || !value.trim()}
          onClick={saveAs}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Farklı Kaydet
        </button>
      </div>

      {(message || error) && (
        <p className={`text-xs ${error ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
          {error ?? message}
        </p>
      )}

      {savedPrompts.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
          <p className="border-b border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800">
            Kayıtlı Promptlarım
          </p>
          <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
            {savedPrompts.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">{entry.name}</p>
                  <p className="text-neutral-400">{new Date(entry.createdAt).toLocaleString("tr-TR")}</p>
                  <p className="mt-0.5 truncate text-neutral-600 dark:text-neutral-400" title={entry.promptText}>
                    {entry.promptText}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => loadSavedPrompt(entry)}
                    className="rounded-md border border-neutral-300 px-2.5 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Kullan
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => deleteSaved(entry)}
                    className="rounded-md border border-red-300 px-2.5 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialog}
    </div>
  );
}
