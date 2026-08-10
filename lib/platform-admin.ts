/**
 * Platform sahibinin (LeadLens'in kendisi) erişimi — hesap sahipliğinden
 * (`isAccountOwner`) tamamen ayrı bir kavram. Henüz ayrı bir "platform admin"
 * rolü/tablosu yok, en basit çözüm olarak tek bir env değişkeniyle kontrol
 * ediliyor: PLATFORM_ADMIN_EMAILS, virgülle ayrılmış e-posta listesi.
 */
export function isPlatformAdmin(email: string): boolean {
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
