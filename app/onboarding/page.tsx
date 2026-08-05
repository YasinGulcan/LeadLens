import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", accountId).single();
  // Hesap silinmişse (ör. kaza sonucu oluşan boş hesapların temizlenmesi) ama
  // tarayıcıda hâlâ o hesaba ait eski (imza olarak geçerli) bir oturum
  // çerezi varsa, "hayalet" bir onboarding ekranı göstermek yerine sıfırdan
  // başlat — bkz. app/dashboard/layout.tsx'teki aynı desen.
  if (!account) redirect("/");
  if (account.onboarded_at) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Hoş geldiniz 👋</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Gmail bağlantınız kuruldu. Son bir adım: panelinizi hazırlayalım.
      </p>
      <OnboardingForm />
    </main>
  );
}
