import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DashboardGmailPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("connected_email, connected_at")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: account } = await supabase.from("accounts").select("lead_email_subject").eq("id", accountId).single();

  return (
    <section>
      <h2 className="text-lg font-semibold">Gmail Bağlantısı</h2>
      {connection ? (
        <p className="mt-2 text-sm">
          Bağlı: <strong>{connection.connected_email}</strong>{" "}
          <span className="text-neutral-500">({new Date(connection.connected_at).toLocaleString("tr-TR")})</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">Henüz bağlı değil.</p>
      )}
      <a
        href={`/api/oauth/gmail/start?accountId=${accountId}`}
        className="mt-3 inline-block rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        {connection ? "Yeniden Bağla" : "Gmail'i Bağla"}
      </a>

      {account && (
        <p className="mt-6 text-xs text-neutral-500">
          Lead e-postası başlığı: <code>{account.lead_email_subject}</code> — değiştirmek için{" "}
          <a href="/dashboard/settings" className="text-blue-600 hover:underline dark:text-blue-400">
            Ayarlar
          </a>
          &apos;a bakın.
        </p>
      )}
    </section>
  );
}
