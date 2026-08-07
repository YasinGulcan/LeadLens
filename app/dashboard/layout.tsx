import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { acceptTeamMembership, isAccountOwner, isAuthorizedForAccount } from "@/lib/accounts";
import { getSetupStatus } from "@/lib/setup-checklist";
import { supabase } from "@/lib/supabase";
import { DashboardSidebar } from "./DashboardSidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const [{ data: account }, { count: leadCount }, setupStatus] = await Promise.all([
    supabase.from("accounts").select("business_name, slug, onboarded_at").eq("id", accountId).single(),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    getSetupStatus(accountId),
  ]);
  if (!account) redirect("/");
  // Oturum çerezi 30 gün geçerli kalabiliyor — ekipten çıkarıldıktan sonra
  // bile eski çerez taşınabilir, bu yüzden her girişte yetki tekrar
  // doğrulanır (sadece ilk "Google ile Bağlan" anında değil).
  if (!(await isAuthorizedForAccount(accountId, session.email))) redirect("/");
  if (!account.onboarded_at) redirect("/onboarding");

  // "Kabul edildi" işareti sadece taze bir Google girişinde değil, panele her
  // başarılı erişimde de tetiklenir — aksi halde tarayıcıda zaten geçerli bir
  // oturum çerezi olan (yeniden davet sonrası hiç OAuth'a hiç uğramayan) bir
  // üye panelde gezinirken "bekliyor" olarak görünmeye devam ederdi.
  if (!(await isAccountOwner(accountId, session.email))) {
    await acceptTeamMembership(accountId, session.email);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        businessName={account.business_name}
        email={session.email}
        leadCount={leadCount ?? 0}
        setupProgress={setupStatus.requiredDone ? null : { completed: setupStatus.completedCount, total: setupStatus.totalCount }}
      />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <div className="border-b border-border px-8 py-4 text-xs text-muted-foreground">
          Form adresi: /form/{account.slug}
        </div>
        <main className="px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
