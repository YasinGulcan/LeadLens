import { supabase } from "./supabase";
import type { GmailAccount } from "./gmail";

export interface Account {
  id: string;
  businessName: string;
  slug: string;
  leadEmailSubject: string;
  status: string;
  notificationEmail: string | null;
}

const ACCOUNT_COLUMNS = "id, business_name, slug, lead_email_subject, status, notification_email";

function toAccount(row: {
  id: string;
  business_name: string;
  slug: string;
  lead_email_subject: string;
  status: string;
  notification_email: string | null;
}): Account {
  return {
    id: row.id,
    businessName: row.business_name,
    slug: row.slug,
    leadEmailSubject: row.lead_email_subject,
    status: row.status,
    notificationEmail: row.notification_email,
  };
}

export async function getAccountBySlug(slug: string): Promise<Account | null> {
  const { data, error } = await supabase.from("accounts").select(ACCOUNT_COLUMNS).eq("slug", slug).single();
  if (error || !data) return null;
  return toAccount(data);
}

export async function getAccountById(id: string): Promise<Account | null> {
  const { data, error } = await supabase.from("accounts").select(ACCOUNT_COLUMNS).eq("id", id).single();
  if (error || !data) return null;
  return toAccount(data);
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select(ACCOUNT_COLUMNS).order("created_at", { ascending: true });
  if (error) throw new Error(`Hesaplar okunamadı: ${error.message}`);
  return (data ?? []).map(toAccount);
}

/** Bir hesabın Gmail bağlantısını (varsa) çözer, `lib/gmail.ts` fonksiyonlarının beklediği şekle çevirir. */
export async function loadGmailAccount(accountId: string): Promise<GmailAccount | null> {
  const { data: acc, error: accError } = await supabase
    .from("accounts")
    .select("id, lead_email_subject, notification_email")
    .eq("id", accountId)
    .single();
  if (accError || !acc) return null;

  const { data: connection, error: connError } = await supabase
    .from("gmail_connections")
    .select("encrypted_refresh_token")
    .eq("account_id", accountId)
    .single();
  if (connError || !connection) return null;

  return {
    id: acc.id,
    leadEmailSubject: acc.lead_email_subject,
    encryptedRefreshToken: connection.encrypted_refresh_token,
    notificationEmail: acc.notification_email,
    teamEmails: await listTeamMemberEmails(accountId),
  };
}

export interface TeamMember {
  id: string;
  email: string;
  invitedAt: string;
}

/** Hesabın Gmail'ini bağlayan e-posta — sadece bu kişi Gmail bağlama/kesme ve ekip yönetimi gibi hassas işlemleri yapabilir. */
export async function getAccountOwnerEmail(accountId: string): Promise<string | null> {
  const { data } = await supabase
    .from("gmail_connections")
    .select("connected_email")
    .eq("account_id", accountId)
    .single();
  return data?.connected_email ?? null;
}

export async function isAccountOwner(accountId: string, email: string): Promise<boolean> {
  const ownerEmail = await getAccountOwnerEmail(accountId);
  return ownerEmail !== null && ownerEmail === email;
}

export async function listTeamMembers(accountId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("account_members")
    .select("id, email, invited_at")
    .eq("account_id", accountId)
    .order("invited_at", { ascending: true });
  if (error) throw new Error(`Ekip üyeleri okunamadı: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, email: row.email, invitedAt: row.invited_at }));
}

async function listTeamMemberEmails(accountId: string): Promise<string[]> {
  const { data } = await supabase.from("account_members").select("email").eq("account_id", accountId);
  return (data ?? []).map((row) => row.email);
}

/** Verilen e-postayı hesaba ekip üyesi olarak ekler. E-posta zaten (bu ya da başka bir hesapta) üye/sahipse hata verir. */
export async function addTeamMember(accountId: string, email: string): Promise<TeamMember> {
  // Bu e-posta zaten başka bir hesabın SAHİBİyse (kendi Gmail'ini bağlamışsa) davet etmiyoruz —
  // "Google ile Bağlan" akışı sahiplik eşleşmesini üyelikten önce kontrol ettiği için, davetli
  // olsa bile giriş yaptığında hep kendi hesabına düşer, üyelik hiçbir zaman ulaşılamaz olur.
  const { data: existingConnection } = await supabase
    .from("gmail_connections")
    .select("account_id")
    .eq("connected_email", email)
    .maybeSingle();
  if (existingConnection) {
    throw new Error(
      existingConnection.account_id === accountId
        ? "Bu e-posta zaten bu hesabın sahibi."
        : "Bu e-posta zaten başka bir hesabın (kendi Gmail'ini bağlamış) sahibi, ekip üyesi olarak eklenemez."
    );
  }

  const { data, error } = await supabase
    .from("account_members")
    .insert({ account_id: accountId, email })
    .select("id, email, invited_at")
    .single();
  if (error) {
    const message = error.code === "23505" ? "Bu e-posta zaten bir ekibe davetli." : error.message;
    throw new Error(message);
  }
  return { id: data.id, email: data.email, invitedAt: data.invited_at };
}

export async function removeTeamMember(accountId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from("account_members").delete().eq("id", memberId).eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

/** Bu e-posta bir hesabın ekip üyesiyse o hesabın id'sini döner (sahiplik kontrolü ayrı — bkz. isAccountOwner). */
export async function findAccountIdByMemberEmail(email: string): Promise<string | null> {
  const { data } = await supabase.from("account_members").select("account_id").eq("email", email).maybeSingle();
  return data?.account_id ?? null;
}

/** Devri başlatan sahip, hangi ekip üyesinin "gelecek sahip" olarak işaretlendiğini görebilsin diye. */
export async function getPendingOwnerEmail(accountId: string): Promise<string | null> {
  const { data } = await supabase.from("accounts").select("pending_owner_email").eq("id", accountId).single();
  return data?.pending_owner_email ?? null;
}

/** Sahiplik devrini başlatır — gerçek devir, hedef kişi kendi Gmail'ini bağlayınca OAuth callback'te tamamlanır. */
export async function setPendingOwnerTransfer(accountId: string, memberEmail: string): Promise<void> {
  const { error } = await supabase.from("accounts").update({ pending_owner_email: memberEmail }).eq("id", accountId);
  if (error) throw new Error(error.message);
}

export async function clearPendingOwnerTransfer(accountId: string): Promise<void> {
  const { error } = await supabase.from("accounts").update({ pending_owner_email: null }).eq("id", accountId);
  if (error) throw new Error(error.message);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "hesap";
}

/** Verilen taban isimden, `accounts.slug`'ta çakışmayan bir slug üretir (çakışırsa -2, -3... ekler). */
export async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let suffix = 2;
  for (;;) {
    const { data } = await supabase.from("accounts").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${root}-${suffix}`;
    suffix++;
  }
}

/** `status='connected'` olan tüm hesapların Gmail bağlantı bilgisini yükler (cron'un tüm hesapları gezmesi için). */
export async function loadConnectedGmailAccounts(): Promise<GmailAccount[]> {
  const { data: accounts, error } = await supabase.from("accounts").select("id").eq("status", "connected");
  if (error) throw new Error(`Hesaplar okunamadı: ${error.message}`);

  const result: GmailAccount[] = [];
  for (const acc of accounts ?? []) {
    const account = await loadGmailAccount(acc.id);
    if (account) result.push(account);
  }
  return result;
}
