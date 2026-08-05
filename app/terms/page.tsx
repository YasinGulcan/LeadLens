import Link from "next/link";

export const metadata = { title: "Hizmet Şartları — LeadLens" };

const CONTACT_EMAIL = "yasingulcan288@gmail.com";

/** Basit hizmet şartları taslağı — hukuki inceleme önerilir. */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
      <Link href="/" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
        ← Ana sayfaya dön
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-white">Hizmet Şartları</h1>
      <p className="mt-1 text-xs text-neutral-500">Son güncelleme: 05.08.2026</p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Hizmetin Tanımı</h2>
      <p className="mt-2">
        LeadLens, web sitenizden gelen form başvurularını Gmail hesabınız üzerinden okuyup analiz eden ve
        satış ekibinize rapor olarak ileten bir otomasyon aracıdır. Hizmete &quot;Google ile Bağlan&quot; ile
        kaydolur ve giriş yaparsınız.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Hesap Sorumluluğu</h2>
      <p className="mt-2">
        Hesabınıza bağladığınız Gmail hesabından ve panele davet ettiğiniz ekip üyelerinden siz
        sorumlusunuz. Panelde paylaştığınız web sitesi/ürün içeriğinin doğruluğundan ve paylaşma
        yetkinizden siz sorumlusunuz.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Kabul Edilebilir Kullanım</h2>
      <p className="mt-2">
        Hizmeti yasa dışı amaçlarla, spam göndermek için ya da başkalarının açık rızası olmadan kişisel
        verilerini toplamak için kullanamazsınız. Hizmetin işleyişine zarar verecek (aşırı yük bindirme,
        güvenlik açığı arama vb.) faaliyetler yasaktır.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Hizmet Garantisi Yok</h2>
      <p className="mt-2">
        LeadLens &quot;olduğu gibi&quot; sunulur. Kesintisiz veya hatasız çalışacağını garanti etmeyiz.
        Analiz sonuçları (ürün önerisi, skor, bulgular) yapay zeka tarafından üretilir; nihai satış
        kararları için tek başına dayanak olarak kullanılmamalıdır.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Sorumluluğun Sınırlandırılması</h2>
      <p className="mt-2">
        Yürürlükteki mevzuatın izin verdiği azami ölçüde, hizmetin kullanımından doğabilecek dolaylı
        zararlardan sorumlu tutulamayız.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Değişiklikler</h2>
      <p className="mt-2">
        Bu şartları zaman zaman güncelleyebiliriz. Önemli değişiklikler bu sayfada yayınlanır.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Uygulanacak Hukuk</h2>
      <p className="mt-2">Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir.</p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">İletişim</h2>
      <p className="mt-2">
        Sorularınız için:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline dark:text-blue-400">
          {CONTACT_EMAIL}
        </a>
      </p>
    </main>
  );
}
