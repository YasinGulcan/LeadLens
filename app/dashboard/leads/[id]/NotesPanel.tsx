"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardTitle, Button } from "@/components/ui";
import { useConfirm } from "../../useConfirm";

export interface LeadNote {
  id: string;
  authorEmail: string;
  content: string;
  createdAt: string;
}

/** Lead detay sağ sütunundaki "Notlar" — manuel/insan notları, otomatik İşlem Geçmişi'nden ayrı bir kavram. */
export function NotesPanel({
  leadId,
  notes,
  currentEmail,
  isOwner,
}: {
  leadId: string;
  notes: LeadNote[];
  currentEmail: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = content.trim();
    if (!trimmed) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setContent("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!(await confirm("Bu not silinsin mi?", { danger: true }))) return;
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/notes/${noteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    }
  }

  return (
    <Card className="p-4">
      <CardTitle>Notlar</CardTitle>

      <div className="mt-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Bir not ekle..."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
        <Button variant="primary" size="sm" className="mt-2" disabled={pending || !content.trim()} onClick={handleAdd}>
          {pending ? "Ekleniyor..." : "Ekle"}
        </Button>
        {error && <p className="mt-2 text-xs text-red-400/80">{error}</p>}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz not eklenmemiş.</p>
        ) : (
          <ol className="space-y-3">
            {notes.map((note) => {
              const canDelete = note.authorEmail === currentEmail || isOwner;
              return (
                <li key={note.id} className="flex items-start gap-3 text-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold text-muted-foreground">
                    {note.authorEmail[0]!.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-muted-foreground">
                        {note.authorEmail} — {new Date(note.createdAt).toLocaleString("tr-TR")}
                      </p>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          aria-label="Notu sil"
                          className="shrink-0 text-muted-foreground/60 hover:text-red-400/80"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-foreground">{note.content}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {dialog}
    </Card>
  );
}
