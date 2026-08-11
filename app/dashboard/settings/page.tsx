import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { getActivePricingPlans } from "@/lib/pricing";
import { getTrialInfo } from "@/lib/trial";
import { supabase } from "@/lib/supabase";
import { Card, Button } from "@/components/ui";
import { SettingsForm } from "../SettingsForm";
import { DangerZone } from "./DangerZone";
import { SettingsTabs } from "./SettingsTabs";
import { PricingSection } from "../../PricingSection";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const { tab } = await searchParams;

  const [{ data: account }, isOwner, activePlans] = await Promise.all([
    supabase.from("accounts").select("business_name, slug, lead_email_subjects, created_at, active_plan_id").eq("id", accountId).single(),
    isAccountOwner(accountId, session.email),
    getActivePricingPlans(),
  ]);

  const showPlanTab = activePlans.length > 0;
  const activeTab = tab === "plan" && showPlanTab ? "plan" : "genel";

  if (!account) redirect("/");

  const trial = getTrialInfo(account.created_at);
  let activePlanName: string | null = null;
  if (account.active_plan_id) {
    const { data: plan } = await supabase.from("pricing_plans").select("name").eq("id", account.active_plan_id).maybeSingle();
    activePlanName = plan?.name ?? null;
  }

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
      <SettingsTabs current={activeTab} showPlanTab={showPlanTab} />

      {activeTab === "plan" ? (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">Mevcut planlardan birini inceleyebilirsiniz.</p>
          <PricingSection plans={activePlans} />
        </div>
      ) : (
        <>
          <SettingsForm
            initialBusinessName={account.business_name}
            initialSlug={account.slug}
            initialLeadEmailSubjects={account.lead_email_subjects}
          />

          <div className="mt-8">
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {activePlanName
                    ? `${activePlanName} — Aktif`
                    : trial.isExpired
                      ? "Deneme Sürümü"
                      : `Ücretsiz Deneme — ${trial.daysLeft} gün kaldı`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activePlanName
                    ? "Aboneliğiniz aktif, teşekkürler!"
                    : trial.isExpired
                      ? "Deneme süreniz sona erdi — hiçbir kısıtlama yok, dilediğinizde bir plana geçebilirsiniz."
                      : "14 günlük deneme süreniz boyunca tüm özellikler açık."}
                </p>
              </div>
              {showPlanTab && (
                <Link href="/dashboard/settings?tab=plan">
                  <Button variant="secondary" size="sm">
                    {activePlanName ? "Planı Değiştir" : "Planları Görüntüle"}
                  </Button>
                </Link>
              )}
            </Card>
          </div>

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
        </>
      )}
    </section>
  );
}
