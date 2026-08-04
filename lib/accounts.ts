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
  };
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
