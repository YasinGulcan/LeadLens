"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Sparkles } from "lucide-react";
import { useConfirm } from "./useConfirm";
import { Button } from "@/components/ui";

interface Draft {
  subject: string;
  bodyHtml: string;
}

type DraftTone = "resmi" | "samimi" | "teknik";
const TONES: { value: DraftTone; label: string }[] = [
  { value: "resmi", label: "Resmi" },
  { value: "samimi", label: "Samimi" },
  { value: "teknik", label: "Teknik" },
];

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded px-2 py-1 text-sm font-medium ${
        active ? "bg-accent text-white" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      <ToolbarButton label="Kalın" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>K</strong>
      </ToolbarButton>
      <ToolbarButton label="İtalik" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>İ</em>
      </ToolbarButton>
      <ToolbarButton label="Altı çizili" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">A</span>
      </ToolbarButton>
      <ToolbarButton
        label="Madde listesi"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        label="Numaralı liste"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
    </div>
  );
}

/**
 * Taslak, sayfa her yüklendiğinde OTOMATİK üretilmiyor — yalnızca "Taslak
 * Oluştur"a basıldığında bir Claude çağrısı yapılıyor. Çoğu lead'e satış
 * ekibi telefonla dönüyor, hazır yanıt her lead için gerekmiyor; otomatik
 * üretim, çoğu ziyarette hiç kullanılmayacak bir LLM çağrısını (ve
 * masrafını) her sayfa yenilemesinde tekrarlardı.
 */
export function DraftReply({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const { confirm, dialog } = useConfirm();
  const [tone, setTone] = useState<DraftTone>("samimi");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-sm max-w-none px-3 py-2 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2",
      },
    },
  });

  useEffect(() => {
    if (draft && editor) {
      editor.commands.setContent(draft.bodyHtml);
    }
  }, [draft, editor]);

  async function generateDraft() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setDraft({ subject: data.subject, bodyHtml: data.bodyHtml });
      setSubject(data.subject);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setGenerating(false);
    }
  }

  function closeDraft() {
    setDraft(null);
    setMessage(null);
    setError(null);
  }

  async function copyToClipboard() {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText();
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setMessage("Panoya kopyalandı.");
      setError(null);
      fetch(`/api/dashboard/leads/${leadId}/draft/copy-log`, { method: "POST" }).catch(() => {});
    } catch {
      setError("Panoya kopyalanamadı.");
    }
  }

  async function sendDraft() {
    if (!editor || !leadEmail) return;
    if (!(await confirm(`Bu taslak "${leadEmail}" adresine gönderilsin mi?`))) return;

    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/draft/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyHtml: editor.getHTML() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setMessage(`"${leadEmail}" adresine gönderildi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Sparkles size={13} className="text-accent" />
          Hazır Yanıt Taslağı
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  tone === t.value ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" disabled={generating} onClick={generateDraft}>
            {generating ? "Oluşturuluyor..." : draft ? "Yeniden Oluştur" : "Taslak Oluştur"}
          </Button>
        </div>
      </div>

      {!draft && !generating && (
        <p className="mt-2 text-xs text-muted-foreground">
          Claude, bu lead&apos;in mesajı, site bulgusu ve önerilen ürüne dayanarak satış ekibi adına bir e-posta taslağı hazırlar.
        </p>
      )}

      {draft && (
        <div className="mt-4 space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Konu"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:border-accent focus:outline-none"
          />
          <div className="rounded-md border border-border bg-background">
            {editor && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="primary"
              disabled={sending || !leadEmail}
              onClick={sendDraft}
              title={leadEmail ? undefined : "Bu lead için e-posta adresi kayıtlı değil"}
            >
              {sending ? "Gönderiliyor..." : "Otomatik Gönder"}
            </Button>
            <Button variant="secondary" onClick={copyToClipboard}>
              Panoya Kopyala
            </Button>
            <Button variant="secondary" onClick={closeDraft}>
              Kapat
            </Button>
          </div>
          {!leadEmail && (
            <p className="text-xs text-muted-foreground">
              Bu lead formda e-posta paylaşmamış — &quot;Otomatik Gönder&quot; bu yüzden pasif. Taslağı kopyalayıp kendi e-posta
              istemcinizden gönderebilirsiniz.
            </p>
          )}
        </div>
      )}

      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-400/80">{error}</p>}
      {dialog}
    </div>
  );
}
