import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { acceptTeamMembership, isAccountOwner, isAuthorizedForAccount } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { DashboardNav } from "./DashboardNav";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const { data: account } = await supabase.from("accounts").select("business_name, slug, onboarded_at").eq("id", accountId).single();
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{account.business_name}</h1>
          <p className="mt-1 text-sm text-neutral-500">Form adresi: /form/{account.slug}</p>
        </div>
        <div className="flex items-center gap-3 text-right">
          <span className="text-sm text-neutral-500">{session.email}</span>
          <LogoutButton />
        </div>
      </div>

      <DashboardNav />

      <main className="mt-8">{children}</main>
    </div>
  );
}
