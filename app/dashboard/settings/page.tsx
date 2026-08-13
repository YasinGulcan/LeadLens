import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { getActivePricingPlans } from "@/lib/pricing";
import { getTrialInfo } from "@/lib/trial";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/claude";
import { listSavedPrompts } from "@/lib/prompt-library";
import { Card, Button } from "@/components/ui";
import { SettingsForm } from "../SettingsForm";
import { PromptForm } from "../PromptForm";
import { ProfileNameForm } from "../ProfileNameForm";
import { ChangePasswordForm } from "../ChangePasswordForm";
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
    supabase
      .from("accounts")
      .select(
        "business_name, slug, lead_email_subjects, created_at, active_plan_id, custom_system_prompt, business_sector, website_url, team_size"
      )
      .eq("id", accountId)
      .single(),
    isAccountOwner(accountId, session.email),
    getActivePricingPlans(),
  ]);

  const showPlanTab = activePlans.length > 0;
  const activeTab =
    tab === "plan" && showPlanTab ? "plan" : tab === "prompt" ? "prompt" : tab === "hesabim" ? "hesabim" : "genel";
  const savedPrompts = activeTab === "prompt" ? await listSavedPrompts(accountId) : [];

  if (!account) redirect("/");

  let myFullName: string | null = null;
  if (activeTab === "hesabim") {
    if (isOwner) {
      const { data } = await supabase.from("accounts").select("owner_full_name").eq("id", accountId).single();
      myFullName = data?.owner_full_name ?? null;
    } else {
      const { data } = await supabase
        .from("account_members")
        .select("full_name")
        .eq("account_id", accountId)
        .eq("email", session.email)
        .maybeSingle();
      myFullName = data?.full_name ?? null;
    }
  }

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
          <PricingSection plans={activePlans} hasSession activePlanId={account.active_plan_id} canPurchase={isOwner} />
        </div>
      ) : activeTab === "prompt" ? (
        <div className="mt-6">
          <PromptForm
            initialCustomPrompt={account.custom_system_prompt}
            defaultPrompt={DEFAULT_SYSTEM_PROMPT}
            savedPrompts={savedPrompts}
            isOwner={isOwner}
          />
        </div>
      ) : activeTab === "hesabim" ? (
        <div className="mt-6 space-y-10">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ad Soyad</h3>
            <div className="mt-3">
              <ProfileNameForm initialFullName={myFullName} />
            </div>
          </div>
          <div className="border-t border-border pt-8">
            <h3 className="text-sm font-semibold text-foreground">Şifre</h3>
            <div className="mt-3">
              <ChangePasswordForm />
            </div>
          </div>
        </div>
      ) : (
        <>
          <SettingsForm
            initialBusinessName={account.business_name}
            initialSlug={account.slug}
            initialLeadEmailSubjects={account.lead_email_subjects}
            initialBusinessSector={account.business_sector}
            initialWebsiteUrl={account.website_url}
            initialTeamSize={account.team_size}
            isOwner={isOwner}
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
                      ? showPlanTab
                        ? "Deneme süreniz sona erdi — hiçbir kısıtlama yok, dilediğinizde bir plana geçebilirsiniz."
                        : "Deneme süreniz sona erdi — hiçbir kısıtlama yok."
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
