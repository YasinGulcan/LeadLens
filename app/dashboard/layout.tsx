import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { acceptTeamMembership, hasRealPassword, isAccountOwner, isAuthorizedForAccount } from "@/lib/accounts";
import { getSetupStatus } from "@/lib/setup-checklist";
import { listNotifications, getUnreadNotificationCount } from "@/lib/notifications";
import { getTrialInfo } from "@/lib/trial";
import { getActivePricingPlans, getActivePlanInfo, type ActivePlanInfo } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { DashboardSidebar } from "./DashboardSidebar";
import { NotificationBell } from "./NotificationBell";
import { TrialLockScreen } from "./TrialLockScreen";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const [{ data: account }, { count: leadCount }, setupStatus, notifications, unreadCount, activePlans] = await Promise.all([
    supabase
      .from("accounts")
      .select("business_name, slug, onboarded_at, created_at, active_plan_id, plan_started_at")
      .eq("id", accountId)
      .single(),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    getSetupStatus(accountId),
    listNotifications(accountId, session.email),
    getUnreadNotificationCount(accountId, session.email),
    getActivePricingPlans(),
  ]);
  if (!account) redirect("/");

  let activePlanName: string | null = null;
  let activePlanInfo: ActivePlanInfo | null = null;
  if (account.active_plan_id) {
    const { data: plan } = await supabase
      .from("pricing_plans")
      .select("name, billing_period")
      .eq("id", account.active_plan_id)
      .maybeSingle();
    activePlanName = plan?.name ?? null;
    if (plan && account.plan_started_at) {
      activePlanInfo = getActivePlanInfo(account.plan_started_at, plan.billing_period === "yearly" ? "yearly" : "monthly");
    }
  }
  const trial = getTrialInfo(account.created_at);
  // Deneme bitip aktif bir plan seçilmemişse panel kilitlenir — seçilebilecek
  // hiç plan yoksa (activePlans boş) kimseyi çıkışsız bırakmamak için kilit
  // devre dışı kalır.
  const isLocked = trial.isExpired && !activePlanName && activePlans.length > 0;
  // Oturum çerezi 30 gün geçerli kalabiliyor — ekipten çıkarıldıktan sonra
  // bile eski çerez taşınabilir, bu yüzden her girişte yetki tekrar
  // doğrulanır (sadece ilk "Google ile Bağlan" anında değil).
  if (!(await isAuthorizedForAccount(accountId, session.email))) redirect("/");
  // Davet/sahiplik devri kabulü, gerçek bir şifre belirlenmeden önce
  // signInWithoutPassword ile geçici bir oturum kurar (bkz. confirm-join) —
  // proxy.ts bu oturumu geçerli sayıp içeri aldığı için burada ayrıca
  // zorlanmazsa kişi hiç şifre belirlemeden panelde gezinebilir.
  if (!(await hasRealPassword(accountId, session.email))) redirect("/set-password");
  if (!account.onboarded_at) redirect("/onboarding");

  const isOwner = await isAccountOwner(accountId, session.email);
  // "Kabul edildi" işareti sadece taze bir davet kabulünde değil, panele her
  // başarılı erişimde de tetiklenir — aksi halde tarayıcıda zaten geçerli bir
  // oturum çerezi olan (yeniden davet sonrası hiç kabul akışına hiç
  // uğramayan) bir üye panelde gezinirken "bekliyor" olarak görünmeye devam
  // ederdi.
  if (!isOwner) {
    await acceptTeamMembership(accountId, session.email);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        businessName={account.business_name}
        email={session.email}
        leadCount={leadCount ?? 0}
        setupProgress={setupStatus.requiredDone ? null : { completed: setupStatus.completedCount, total: setupStatus.totalCount }}
        trial={trial}
        activePlanName={activePlanName}
        activePlanInfo={activePlanInfo}
      />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <div className="flex items-center justify-between border-b border-border px-8 py-4 text-xs text-muted-foreground">
          <span>Form adresi: /form/{account.slug}</span>
          <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
        </div>
        <main className="px-8 py-8">{isLocked ? <TrialLockScreen plans={activePlans} isOwner={isOwner} /> : children}</main>
      </div>
    </div>
  );
}
