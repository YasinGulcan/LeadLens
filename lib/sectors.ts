/**
 * Onboarding VE Ayarlar > İşletme Profili aynı listeyi kullanır — sektör
 * artık serbest metin değil (herkes farklı yazıp "Dijital Pazarlama" ile
 * "Online Pazarlama" gibi tutarsız değerler biriktiriyordu), tek kaynaktan
 * seçiliyor. `OTHER_SECTOR`, önceden serbest metinle kaydedilmiş ve listeye
 * uymayan mevcut değerleri kaybetmemek için "Diğer" + serbest metin alanına düşer.
 */
export const SECTORS = [
  "E-ticaret",
  "Mobilya",
  "Gıda & İçecek",
  "Dijital Ajans / Pazarlama",
  "Yazılım / SaaS",
  "Danışmanlık",
  "Emlak",
  "Sağlık / Klinik",
  "Eğitim",
  "Turizm / Otelcilik",
  "İnşaat / Yapı",
  "Üretim / İmalat",
];

export const OTHER_SECTOR = "Diğer";
