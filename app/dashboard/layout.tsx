import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAuthorizedForAccount } from "@/lib/accounts";
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{account.business_name}</h1>
          <p className="mt-1 text-sm text-neutral-500">Form adresi: /form/{account.slug}</p>
        </div>
        <LogoutButton />
      </div>

      <DashboardNav />

      <main className="mt-8">{children}</main>
    </div>
  );
}
