import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, getOrCreateInboundToken } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { buildInboundAddress } from "@/lib/inbound-email";
import { MailSourceContent } from "./MailSourceContent";

export const dynamic = "force-dynamic";

export default async function DashboardGmailPage({ searchParams }: { searchParams: Promise<{ connectError?: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;
  const { connectError } = await searchParams;

  const [{ data: connection }, { data: account }, isOwner, inboundToken] = await Promise.all([
    supabase.from("gmail_connections").select("connected_email, connected_at, disconnected_at").eq("account_id", accountId).maybeSingle(),
    supabase
      .from("accounts")
      .select("lead_email_subjects, slug, primary_lead_source, inbound_last_received_at")
      .eq("id", accountId)
      .single(),
    isAccountOwner(accountId, session.email),
    getOrCreateInboundToken(accountId),
  ]);

  const inboundAddress = account ? buildInboundAddress(account.slug, inboundToken) : null;

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Mail Kaynağı</h2>

      {connectError && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {connectError}
        </p>
      )}

      <div className="mt-4">
        <MailSourceContent accountId={accountId} isOwner={isOwner} connection={connection} account={account} inboundAddress={inboundAddress} />
      </div>
    </section>
  );
}
