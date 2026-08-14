import { supabase } from "./supabase";
import type { GmailAccount } from "./gmail";
import { generateInboundToken } from "./inbound-email";

export type PrimaryLeadSource = "gmail" | "forwarding";
export type TeamSize = "solo" | "2-5" | "6-20" | "20+";

export interface Account {
  id: string;
  businessName: string;
  slug: string;
  leadEmailSubjects: string[];
  status: string;
  notificationEmail: string | null;
  /** Panelde düzenlenebilen, lead analiz asistanının sistem promptu — boş/null ise lib/claude.ts'teki varsayılan kullanılır. */
  customSystemPrompt: string | null;
  inboundEmailToken: string | null;
  primaryLeadSource: PrimaryLeadSource;
  /** LeadLens'i kullanan İŞLETMENİN kendi sektörü — leads.sector (analiz edilen MÜŞTERİNİN sektörü) ile karıştırılmamalı, ayrı bir kavram. */
  businessSector: string | null;
  websiteUrl: string | null;
  teamSize: TeamSize | null;
}

const ACCOUNT_COLUMNS =
  "id, business_name, slug, lead_email_subjects, status, notification_email, custom_system_prompt, inbound_email_token, primary_lead_source, business_sector, website_url, team_size";

function toAccount(row: {
  id: string;
  business_name: string;
  slug: string;
  lead_email_subjects: string[];
  status: string;
  notification_email: string | null;
  custom_system_prompt: string | null;
  inbound_email_token: string | null;
  primary_lead_source: string;
  business_sector: string | null;
  website_url: string | null;
  team_size: string | null;
}): Account {
  return {
    id: row.id,
    businessName: row.business_name,
    slug: row.slug,
    leadEmailSubjects: row.lead_email_subjects,
    status: row.status,
    notificationEmail: row.notification_email,
    customSystemPrompt: row.custom_system_prompt,
    inboundEmailToken: row.inbound_email_token,
    primaryLeadSource: row.primary_lead_source === "forwarding" ? "forwarding" : "gmail",
    businessSector: row.business_sector,
    websiteUrl: row.website_url,
    teamSize: (["solo", "2-5", "6-20", "20+"] as const).includes(row.team_size as TeamSize) ? (row.team_size as TeamSize) : null,
  };
}

/** Hesabın yönlendirme adresi token'ı yoksa üretip kaydeder, varsa olduğu gibi döner — adres UI'da her zaman gösterilebilsin diye. */
export async function getOrCreateInboundToken(accountId: string): Promise<string> {
  const { data } = await supabase.from("accounts").select("inbound_email_token").eq("id", accountId).single();
  if (data?.inbound_email_token) return data.inbound_email_token;

  const token = generateInboundToken();
  const { error } = await supabase.from("accounts").update({ inbound_email_token: token }).eq("id", accountId);
  if (error) throw new Error(`Yönlendirme token'ı kaydedilemedi: ${error.message}`);
  return token;
}

export async function setPrimaryLeadSource(accountId: string, source: PrimaryLeadSource): Promise<void> {
  const { error } = await supabase.from("accounts").update({ primary_lead_source: source }).eq("id", accountId);
  if (error) throw new Error(error.message);
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

/** Bir hesabın Gmail bağlantısını (varsa VE erişimi kaldırılmamışsa) çözer, `lib/gmail.ts` fonksiyonlarının beklediği şekle çevirir. */
export async function loadGmailAccount(accountId: string): Promise<GmailAccount | null> {
  const { data: acc, error: accError } = await supabase
    .from("accounts")
    .select("id, lead_email_subjects, notification_email")
    .eq("id", accountId)
    .single();
  if (accError || !acc) return null;

  // `disconnected_at` dolu satırlar kimlik/giriş için hâlâ geçerli (bkz.
  // isAccountOwner) ama pipeline (okuma/gönderme) için "bağlantı yok" sayılır.
  const { data: connection, error: connError } = await supabase
    .from("gmail_connections")
    .select("encrypted_refresh_token")
    .eq("account_id", accountId)
    .is("disconnected_at", null)
    .single();
  if (connError || !connection) return null;

  return {
    id: acc.id,
    leadEmailSubjects: acc.lead_email_subjects,
    encryptedRefreshToken: connection.encrypted_refresh_token,
    notificationEmail: acc.notification_email,
    teamEmails: await listTeamMemberEmails(accountId),
  };
}

export interface TeamMember {
  id: string;
  email: string;
  invitedAt: string;
  /** null = davet gönderildi ama kişi henüz hiç giriş yapıp daveti kabul etmedi. */
  acceptedAt: string | null;
  /** Form kopyası/analiz raporu maillerine Cc'lensin mi — sadece hesap sahibi değiştirebilir, bkz. listTeamMemberEmails. */
  receiveCopies: boolean;
}

/** Hesabı OTP ile doğrulayıp kayıt eden (ya da sahiplik devrini kabul eden) e-posta — sadece bu kişi Gmail bağlama/kesme ve ekip yönetimi gibi hassas işlemleri yapabilir. Gmail bağlantısından bağımsız: Mail Kaynağı adımı hiç kurulmamış olsa bile sahiplik bellidir. */
export async function getAccountOwnerEmail(accountId: string): Promise<string | null> {
  const { data } = await supabase.from("accounts").select("owner_email").eq("id", accountId).single();
  return data?.owner_email ?? null;
}

/**
 * Oturumdaki kişi (sahip ya da üye) hiç gerçek bir şifre belirledi mi.
 * Davet/sahiplik devri kabul edilip `signInWithoutPassword` ile geçici bir
 * oturum kurulduğunda bu false kalır — `proxy.ts`'in kontrol ettiği "geçerli
 * oturum var mı" sorusu bunu yakalamaz (oturum gerçekten geçerlidir), bu
 * yüzden panel sayfaları (`/dashboard`, `/onboarding`) bunu ayrıca kontrol
 * edip `/set-password`'e yönlendirmeli.
 */
export async function hasRealPassword(accountId: string, email: string): Promise<boolean> {
  const ownerEmail = await getAccountOwnerEmail(accountId);
  if (ownerEmail === email) {
    const { data } = await supabase.from("accounts").select("owner_password_set_at").eq("id", accountId).single();
    return !!data?.owner_password_set_at;
  }
  const { data } = await supabase
    .from("account_members")
    .select("password_set_at")
    .eq("account_id", accountId)
    .eq("email", email)
    .maybeSingle();
  return !!data?.password_set_at;
}

export async function isAccountOwner(accountId: string, email: string): Promise<boolean> {
  const ownerEmail = await getAccountOwnerEmail(accountId);
  return ownerEmail !== null && ownerEmail === email;
}

/** Bu e-posta zaten bir hesabın sahibi mi — OTP kayıt/giriş akışında yeni hesap açmadan önce çakışma kontrolü için. */
export async function getAccountIdByOwnerEmail(email: string): Promise<string | null> {
  const { data } = await supabase.from("accounts").select("id").eq("owner_email", email).maybeSingle();
  return data?.id ?? null;
}

/**
 * Gmail erişimini "kaldırır" — satır silinmiyor, sadece `disconnected_at`
 * ile "erişim iptal edildi" işaretlenir; pipeline artık bu hesabı
 * okumuyor/bu hesaptan göndermiyor. "Yeniden Bağla" (OAuth) bunu otomatik
 * temizler. (Gmail bağlantısı artık kimlikten bağımsız — bkz. accounts.owner_email.)
 */
export async function disconnectGmail(accountId: string): Promise<void> {
  const { error } = await supabase
    .from("gmail_connections")
    .update({ disconnected_at: new Date().toISOString() })
    .eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

/**
 * Oturumdaki e-postanın hâlâ bu hesaba erişim hakkı olup olmadığını kontrol
 * eder (sahip ya da ekip üyesi). Session cookie'si tek başına 30 gün geçerli
 * kalabiliyor — biri ekipten çıkarıldıktan sonra bile eski çerezi hâlâ
 * taşıyabilir, bu yüzden `/`, `/onboarding` ve `/dashboard` girişlerinde her
 * seferinde tekrar doğrulanır.
 */
export async function isAuthorizedForAccount(accountId: string, email: string): Promise<boolean> {
  if (await isAccountOwner(accountId, email)) return true;
  const { data } = await supabase.from("account_members").select("id").eq("account_id", accountId).eq("email", email).maybeSingle();
  return !!data;
}

/** Sahip hiçbir zaman aynı zamanda "üye" olarak listelenmemeli — normalde `addTeamMember` bunu zaten engeller, ama eski/bozuk veriye karşı burada da süzülür. */
export async function listTeamMembers(accountId: string): Promise<TeamMember[]> {
  const [{ data, error }, ownerEmail] = await Promise.all([
    supabase
      .from("account_members")
      .select("id, email, invited_at, accepted_at, receive_copies")
      .eq("account_id", accountId)
      .order("invited_at", { ascending: true }),
    getAccountOwnerEmail(accountId),
  ]);
  if (error) throw new Error(`Ekip üyeleri okunamadı: ${error.message}`);
  return (data ?? [])
    .filter((row) => row.email !== ownerEmail)
    .map((row) => ({
      id: row.id,
      email: row.email,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at,
      receiveCopies: row.receive_copies,
    }));
}

/** Ekip sayfasındaki kopya al/alma anahtarı — sadece hesap sahibi çağırabilir (route seviyesinde kontrol edilir). */
export async function setMemberReceiveCopies(accountId: string, memberId: string, receiveCopies: boolean): Promise<void> {
  const { error } = await supabase
    .from("account_members")
    .update({ receive_copies: receiveCopies })
    .eq("id", memberId)
    .eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

export interface AssignableMember {
  email: string;
  isOwner: boolean;
}

/** "Ekip Üyesine Ata" dropdown'ı ve profil linkleri için: sahip + daveti kabul etmiş üyeler — bekleyen (henüz hiç giriş yapmamış) davetler hariç. */
export async function listAssignableMembers(accountId: string): Promise<AssignableMember[]> {
  const [ownerEmail, members] = await Promise.all([getAccountOwnerEmail(accountId), listTeamMembers(accountId)]);
  const result: AssignableMember[] = [];
  if (ownerEmail) result.push({ email: ownerEmail, isOwner: true });
  for (const m of members) {
    if (m.acceptedAt) result.push({ email: m.email, isOwner: false });
  }
  return result;
}

/** Bu e-posta hesabın sahibi ya da daveti kabul etmiş bir üyesi mi — `isAuthorizedForAccount`'tan farkı, bekleyen davetleri saymaması (lead atama ve profil sayfası erişimi bunu gerektiriyor, ikisi de gerçekten giriş yapmış birini işaret etmeli). */
export async function isActiveAccountPerson(accountId: string, email: string): Promise<boolean> {
  const members = await listAssignableMembers(accountId);
  return members.some((m) => m.email === email);
}

/** Rapor/form maillerinde Cc'ye eklenecek üye listesi — daveti kabul edip en az bir kez giriş yapmış (bkz. accepted_at, henüz kabul etmemiş biri gerçek lead verisini görmemeli) VE hesap sahibinin bu maillere dahil ettiği (receive_copies) üyeler. */
async function listTeamMemberEmails(accountId: string): Promise<string[]> {
  const { data } = await supabase
    .from("account_members")
    .select("email")
    .eq("account_id", accountId)
    .not("accepted_at", "is", null)
    .eq("receive_copies", true);
  return (data ?? []).map((row) => row.email);
}

/** Verilen e-postayı hesaba ekip üyesi olarak ekler. E-posta zaten (bu ya da başka bir hesapta) üye/sahipse hata verir. */
export async function addTeamMember(accountId: string, email: string): Promise<TeamMember> {
  // Bu e-posta zaten başka bir hesabın SAHİBİyse davet etmiyoruz — OTP giriş akışı
  // sahiplik eşleşmesini üyelikten önce kontrol ettiği için, davetli olsa bile giriş
  // yaptığında hep kendi hesabına düşer, üyelik hiçbir zaman ulaşılamaz olur.
  const existingOwnerAccountId = await getAccountIdByOwnerEmail(email);
  if (existingOwnerAccountId) {
    throw new Error(
      existingOwnerAccountId === accountId
        ? "Bu e-posta zaten bu hesabın sahibi."
        : "Bu e-posta zaten başka bir hesabın sahibi, ekip üyesi olarak eklenemez."
    );
  }

  const { data, error } = await supabase
    .from("account_members")
    .insert({ account_id: accountId, email })
    .select("id, email, invited_at, accepted_at, receive_copies")
    .single();
  if (error) {
    const message = error.code === "23505" ? "Bu e-posta zaten bir ekibe davetli." : error.message;
    throw new Error(message);
  }
  return {
    id: data.id,
    email: data.email,
    invitedAt: data.invited_at,
    acceptedAt: data.accepted_at,
    receiveCopies: data.receive_copies,
  };
}

/** Davetli bir üye ilk kez "Google ile Bağlan" ile giriş yaptığında çağrılır — daveti "kabul edilmiş" işaretler. */
export async function acceptTeamMembership(accountId: string, email: string): Promise<void> {
  await supabase
    .from("account_members")
    .update({ accepted_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .eq("email", email)
    .is("accepted_at", null);
}

/** Kişinin kendi profilinde/panelde gösterilen adı — sahipse accounts.owner_full_name, üyeyse account_members.full_name güncellenir. */
export async function updateDisplayName(accountId: string, email: string, fullName: string): Promise<void> {
  const ownerEmail = await getAccountOwnerEmail(accountId);
  if (ownerEmail === email) {
    const { error } = await supabase.from("accounts").update({ owner_full_name: fullName }).eq("id", accountId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("account_members")
    .update({ full_name: fullName })
    .eq("account_id", accountId)
    .eq("email", email);
  if (error) throw new Error(error.message);
}

export async function removeTeamMember(accountId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from("account_members").delete().eq("id", memberId).eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

/** Bu e-posta bir hesabın ekip üyesiyse o hesabın id'sini döner (sahiplik kontrolü ayrı — bkz. isAccountOwner). */
export interface MemberLookup {
  accountId: string;
  acceptedAt: string | null;
}

export async function findAccountIdByMemberEmail(email: string): Promise<MemberLookup | null> {
  const { data } = await supabase.from("account_members").select("account_id, accepted_at").eq("email", email).maybeSingle();
  if (!data) return null;
  return { accountId: data.account_id, acceptedAt: data.accepted_at };
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

export interface NewOwnerInput {
  email: string;
  userId: string;
  fullName: string;
  phone: string | null;
}

/**
 * `/signup` tamamlanınca (Supabase Auth "Confirm email" kapalıysa anında,
 * açıksa kod doğrulandıktan sonra) hesabı gerçekten açar. Şifre bu noktada
 * zaten `auth.users`'ta gerçek (signUp() sırasında verilen) değeriyle
 * kayıtlı olduğu için `owner_password_set_at` da hemen dolduruluyor —
 * yeni kayıtlarda ayrı bir /set-password adımına gerek kalmıyor.
 */
export async function createAccountForNewOwner(input: NewOwnerInput): Promise<{ id: string } | { error: string }> {
  const slug = await generateUniqueSlug(input.fullName);
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      business_name: input.fullName,
      slug,
      status: "pending",
      owner_email: input.email,
      owner_full_name: input.fullName,
      owner_phone: input.phone,
      email_verified_at: new Date().toISOString(),
      owner_user_id: input.userId,
      owner_password_set_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Hesap oluşturulamadı." };
  return { id: data.id };
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
