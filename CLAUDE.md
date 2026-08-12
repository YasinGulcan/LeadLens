@AGENTS.md

# Oturum başlangıcı

Herhangi bir kod değişikliğine başlamadan önce sırayla oku:

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — proje şu an ne yapıyor, mimari nasıl (kısa, güncel anlık görüntü, tarihsiz)
2. [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) — şu anki faz, sırada ne var, hangi soru açık
3. [`docs/PROGRESS.md`](docs/PROGRESS.md) — sadece Oturum Günlüğü'nün **son birkaç girdisi** (tamamını baştan okumaya gerek yok, append-only bir geçmiş kaydı)

Bu üç dosya birlikte "vibecoding" için tasarlandı: ilk ikisi **yerinde
güncellenen anlık görüntüler** (mimari + plan), üçüncüsü **append-only
kronolojik günlük** (ne zaman/neden). Birini diğeriyle karıştırma.

# Döküman güncelleme kuralı — her önemli işten sonra

Kod tabanını etkileyen, birden fazla dosyayı kapsayan veya bir mimari/plan
kararı içeren her değişiklikten sonra (küçük tek satırlık düzeltmeler hariç),
işi "bitti" saymadan önce:

1. **`PROGRESS.md`**'nin Oturum Günlüğü'nün sonuna tarihli, kısa bir
   `### YYYY-MM-DD — Oturum N (başlık)` girdisi ekle — ne yapıldı, neden,
   hangi gerçek testle (tsc/eslint/test/build + varsa gerçek uçtan-uca deneme)
   doğrulandı.
2. Değişiklik mimariyi/şemayı/modül sorumluluklarını etkiliyorsa
   **`docs/ARCHITECTURE.md`**'yi yerinde güncelle (eski cümleyi düzelt/sil,
   tarih ekleme).
3. Değişiklik açık bir soruyu kapattıysa, yeni bir risk/borç ortaya
   çıkardıysa veya "sırada ne var" listesini değiştirdiyse
   **`PROJECT_PLAN.md`**'yi yerinde güncelle.

Migration eklerken kullanıcıya migration'ı çalıştırması gerektiğini açıkça
söyle ve önce onun çalıştırdığını doğrula/bekle (canlı bir sayfa zaten var
olmayan bir kolonu sorguluyorsa push önce migration'ı bekletmeli).
