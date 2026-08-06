import { redirect } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { Card, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardGmailPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const [{ data: connection }, { data: account }, isOwner] = await Promise.all([
    supabase.from("gmail_connections").select("connected_email, connected_at").eq("account_id", accountId).maybeSingle(),
    supabase.from("accounts").select("lead_email_subjects").eq("id", accountId).single(),
    isAccountOwner(accountId, session.email),
  ]);

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Bağlantılar</h2>
      <p className="mt-1 text-sm text-muted-foreground">Lead yakalama ve rapor gönderimi bu Gmail bağlantısı üzerinden çalışır.</p>

      <Card className="mt-4 max-w-xl p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Mail size={18} />
          </span>
          <div className="min-w-0 flex-1">
            {connection ? (
              <>
                <p className="truncate text-sm font-medium text-foreground">{connection.connected_email}</p>
                <p className="text-xs text-muted-foreground">Bağlandı: {new Date(connection.connected_at).toLocaleString("tr-TR")}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Henüz bağlı değil.</p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          {isOwner ? (
            <a href={`/api/oauth/gmail/start?accountId=${accountId}`}>
              <Button variant="primary">
                <RefreshCw size={14} />
                {connection ? "Yeniden Bağla" : "Gmail'i Bağla"}
              </Button>
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Sadece hesap sahibi Gmail bağlantısını değiştirebilir.</p>
          )}
        </div>
      </Card>

      {account && (
        <p className="mt-4 text-xs text-muted-foreground">
          Lead e-postası başlıkları:{" "}
          {(account.lead_email_subjects as string[]).map((subject, i) => (
            <span key={subject}>
              {i > 0 && " veya "}
              <code className="rounded bg-surface-hover px-1 py-0.5">{subject}</code>
            </span>
          ))}{" "}
          — değiştirmek için{" "}
          <a href="/dashboard/settings" className="text-accent hover:underline">
            Ayarlar
          </a>
          &apos;a bakın.
        </p>
      )}
    </section>
  );
}
