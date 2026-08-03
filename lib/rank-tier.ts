// Bağımsız/bağımlılıksız modül — hem sunucu (gmail/resend/claude) hem de
// admin panelin client component'i (LeadsTable) güvenle import edebilsin.
export type RankTier = "iyi" | "orta" | "kötü" | "bulunamadı";

/**
 * Kesin sıra numarası vermek yerine kaba bir sinyale çevirir. Sebep: (1)
 * hangi arama sağlayıcısını kullandığımızı bilmiyoruz, Google ile birebir
 * eşleşeceğinin garantisi yok, (2) lokasyon/kişiselleştirme uygulanmıyor, bu
 * yüzden tam pozisyon numarası (örn. "3. sırada") yanıltıcı bir kesinlik
 * izlenimi veriyordu. SERP tıklama oranı araştırmalarına göre tıklamaların
 * büyük çoğunluğu ilk sayfada, özellikle ilk birkaç sonuçta toplanıyor — bu
 * eşikler o gerçeğe dayanıyor ve sağlayıcı/lokasyon farklarına karşı tam
 * numaradan daha dayanıklı bir sinyal.
 */
export function rankTier(position: number | null): RankTier {
  if (position == null) return "bulunamadı";
  if (position <= 3) return "iyi";
  if (position <= 10) return "orta";
  return "kötü";
}

export const RANK_TIER_LABEL: Record<RankTier, string> = {
  iyi: "İyi (ilk birkaç sonuç arasında)",
  orta: "Orta (ilk sayfada, ama üst sırada değil)",
  kötü: "Zayıf (ilk sayfada değil)",
  bulunamadı: "Bulunamadı",
};
