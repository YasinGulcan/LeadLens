import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { SettingsForm } from "../SettingsForm";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const { data: account } = await supabase
    .from("accounts")
    .select("business_name, slug, lead_email_subjects, notification_email")
    .eq("id", accountId)
    .single();

  if (!account) redirect("/");

  return (
    <section>
      <h2 className="text-lg font-semibold">Ayarlar</h2>
      <SettingsForm
        initialBusinessName={account.business_name}
        initialSlug={account.slug}
        initialLeadEmailSubjects={account.lead_email_subjects}
        initialNotificationEmail={account.notification_email}
      />
    </section>
  );
}
