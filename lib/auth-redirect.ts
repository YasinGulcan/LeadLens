import { isAuthorizedForAccount } from "./accounts";
import { supabase } from "./supabase";
import type { SessionInfo } from "./account-session";

/**
 * `/`, `/login`, `/signup` ortak mantığı: zaten geçerli bir oturumu olan biri
 * bu sayfalardan birine gelirse nereye yönlendirilmesi gerektiğini döner
 * (hesap onboarding'i tamamlamadıysa `/onboarding`, tamamladıysa `/dashboard`).
 * Hesap silinmişse ya da bu e-posta artık yetkili değilse (ör. ekipten
 * çıkarıldı) null döner — çağıran taraf normal giriş ekranını göstermeye devam eder.
 */
export async function resolveAuthenticatedDestination(session: SessionInfo): Promise<string | null> {
  const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", session.accountId).single();
  if (account && (await isAuthorizedForAccount(session.accountId, session.email))) {
    return account.onboarded_at ? "/dashboard" : "/onboarding";
  }
  return null;
}
