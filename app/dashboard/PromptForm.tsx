"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PromptHistoryEntry {
  id: string;
  promptText: string;
  createdAt: string;
}

export function PromptForm({
  initialCustomPrompt,
  defaultPrompt,
  history,
}: {
  initialCustomPrompt: string | null;
  defaultPrompt: string;
  history: PromptHistoryEntry[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialCustomPrompt ?? defaultPrompt);
  const [usingCustom, setUsingCustom] = useState(!!initialCustomPrompt);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(nextValue: string) {
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
    save("");
  }

  function loadFromHistory(entry: PromptHistoryEntry) {
    // Doğrudan kaydetmiyor — kullanıcı önce metni görüp isterse düzenlesin,
    // sonra "Kaydet"e bassın. Yanlışlıkla eski bir sürümü hemen uygulamak istemiyoruz.
    setValue(entry.promptText);
    setMessage("Geçmişten yüklendi — uygulamak için Kaydet'e basın.");
    setError(null);
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
          onClick={() => save(value)}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleReset}
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Varsayılana Sıfırla
        </button>
        {message && <p className="text-xs text-green-600 dark:text-green-400">{message}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {history.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
          <p className="border-b border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800">
            Geçmiş Promptlar — bir versiyonu geri getirmek için &quot;Bu sürümü kullan&quot;a basıp Kaydet&apos;e basın.
          </p>
          <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                <div className="min-w-0">
                  <p className="text-neutral-400">{new Date(entry.createdAt).toLocaleString("tr-TR")}</p>
                  <p className="mt-0.5 truncate text-neutral-600 dark:text-neutral-400" title={entry.promptText}>
                    {entry.promptText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadFromHistory(entry)}
                  className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Bu sürümü kullan
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
