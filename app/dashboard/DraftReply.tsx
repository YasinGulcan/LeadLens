"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useConfirm } from "./useConfirm";

interface Draft {
  subject: string;
  bodyHtml: string;
}

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
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
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
      const res = await fetch(`/api/dashboard/leads/${leadId}/draft`, { method: "POST" });
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
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Hazır Yanıt Taslağı</h3>
        <button
          type="button"
          disabled={generating}
          onClick={generateDraft}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {generating ? "Oluşturuluyor..." : draft ? "Yeniden Oluştur" : "Taslak Oluştur"}
        </button>
      </div>

      {!draft && !generating && (
        <p className="mt-2 text-xs text-neutral-500">
          Claude, bu lead&apos;in mesajı, site bulgusu ve önerilen ürüne dayanarak satış ekibi adına bir e-posta taslağı hazırlar.
        </p>
      )}

      {draft && (
        <div className="mt-4 space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Konu"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="rounded-md border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900">
            {editor && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={sending || !leadEmail}
              onClick={sendDraft}
              title={leadEmail ? undefined : "Bu lead için e-posta adresi kayıtlı değil"}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {sending ? "Gönderiliyor..." : "Otomatik Gönder"}
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Panoya Kopyala
            </button>
            <button
              type="button"
              onClick={closeDraft}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Kapat
            </button>
          </div>
          {!leadEmail && (
            <p className="text-xs text-neutral-400">
              Bu lead formda e-posta paylaşmamış — &quot;Otomatik Gönder&quot; bu yüzden pasif. Taslağı kopyalayıp kendi e-posta
              istemcinizden gönderebilirsiniz.
            </p>
          )}
        </div>
      )}

      {message && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {dialog}
    </div>
  );
}
