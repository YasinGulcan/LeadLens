import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { DashboardNav } from "./DashboardNav";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const { data: account } = await supabase.from("accounts").select("business_name, slug, onboarded_at").eq("id", accountId).single();
  if (!account) redirect("/");
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
