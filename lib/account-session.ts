import { createSupabaseServerClient } from "./supabase-server";
import { supabase } from "./supabase";

export interface SessionInfo {
  accountId: string;
  /** Oturum açan kişinin e-postası — sahip mi (accounts.owner_user_id) yoksa davetli bir ekip üyesi mi (account_members.user_id) ayırt etmek için gerekli. */
  email: string;
  /** Supabase Auth (auth.users) kullanıcı id'si — şifre değiştirme gibi kullanıcının kendi oturumunu gerektiren işlemler için. */
  userId: string;
}

/**
 * DAL katmanı: `app/dashboard` ve `/api/dashboard/*` içindeki "gerçek"
 * yetkilendirme kontrolü — `proxy.ts`'deki optimistic kontrole ek olarak,
 * veriye en yakın yerde tekrar doğrulanır (bkz. Next.js authentication
 * rehberi). Client'tan gelen bir accountId'ye asla güvenilmez, her zaman
 * bu fonksiyonlardan dönen değer kullanılır. Kimlik doğrulama Supabase
 * Auth'ta; accountId eşlemesi (kişi bu hesabın sahibi mi/üyesi mi) hâlâ
 * kendi accounts/account_members tablolarımızda.
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) return null;

  const { data: ownerAccount } = await supabase.from("accounts").select("id").eq("owner_user_id", user.id).maybeSingle();
  if (ownerAccount) return { accountId: ownerAccount.id, email: user.email, userId: user.id };

  const { data: member } = await supabase.from("account_members").select("account_id").eq("user_id", user.id).maybeSingle();
  if (member) return { accountId: member.account_id, email: user.email, userId: user.id };

  return null;
}

/** Sadece accountId gereken (rol farkı önemsiz) çoğu route için kısayol. */
export async function getSessionAccountId(): Promise<string | null> {
  const session = await getSessionInfo();
  return session?.accountId ?? null;
}
