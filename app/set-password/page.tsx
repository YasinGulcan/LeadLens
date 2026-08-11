import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { AuthCard } from "../AuthCard";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

/** Kayıt adım 3'ü, "Şifremi Unuttum" sonrası ve ilk kez davet/devir kabulünün ortak son adımı — üçü de buraya yönlenir. */
export default async function SetPasswordPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  return (
    <AuthCard>
      <SetPasswordForm title="Şifrenizi belirleyin" description="Panele girmek için kullanacağınız şifreyi oluşturun" />
    </AuthCard>
  );
}
