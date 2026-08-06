"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";

export function FileUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function uploadFile(file: File) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (label.trim()) formData.set("label", label.trim());

      const res = await fetch("/api/dashboard/sources/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setMessage(`"${file.name}" işlendi: ${data.chunkCount} chunk kaydedildi.`);
      setLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="mt-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Etiket (opsiyonel)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragActive ? "border-accent bg-accent/5" : "border-border text-muted-foreground hover:border-border-subtle"
        }`}
      >
        <UploadCloud size={20} className={dragActive ? "text-accent" : "text-muted-foreground"} />
        {pending ? (
          "Yükleniyor ve işleniyor..."
        ) : (
          <>
            <span>Dosyayı buraya sürükleyin ya da tıklayıp seçin</span>
            <span className="text-xs text-muted-foreground">.csv, .xlsx, .pdf — en fazla 10 MB</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.pdf"
          onChange={handleInputChange}
          disabled={pending}
          className="hidden"
        />
      </div>

      {message && <p className="mt-2 text-xs text-emerald-500 dark:text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
