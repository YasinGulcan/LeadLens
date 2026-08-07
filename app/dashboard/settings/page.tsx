import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { SettingsForm } from "../SettingsForm";
import { DangerZone } from "./DangerZone";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const [{ data: account }, isOwner] = await Promise.all([
    supabase.from("accounts").select("business_name, slug, lead_email_subjects, notification_email").eq("id", accountId).single(),
    isAccountOwner(accountId, session.email),
  ]);

  if (!account) redirect("/");

  let deletionSummary: { leadCount: number; sourceCount: number; memberCount: number } | null = null;
  if (isOwner) {
    const [{ count: leadCount }, { count: sourceCount }, { count: memberCount }] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", accountId),
      supabase.from("product_sources").select("id", { count: "exact", head: true }).eq("account_id", accountId),
      supabase.from("account_members").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    ]);
    deletionSummary = { leadCount: leadCount ?? 0, sourceCount: sourceCount ?? 0, memberCount: memberCount ?? 0 };
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Ayarlar</h2>
      <SettingsForm
        initialBusinessName={account.business_name}
        initialSlug={account.slug}
        initialLeadEmailSubjects={account.lead_email_subjects}
        initialNotificationEmail={account.notification_email}
      />

      {isOwner && deletionSummary && (
        <div className="mt-12">
          <DangerZone
            businessName={account.business_name}
            leadCount={deletionSummary.leadCount}
            sourceCount={deletionSummary.sourceCount}
            memberCount={deletionSummary.memberCount}
          />
        </div>
      )}
    </section>
  );
}
