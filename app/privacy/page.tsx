import Link from "next/link";

export const metadata = { title: "Gizlilik Politikası — LeadLens" };

const CONTACT_EMAIL = "yasingulcan288@gmail.com";

/**
 * Google OAuth doğrulaması için gereken, herkese açık gizlilik politikası
 * sayfası. Taslak — hukuki inceleme önerilir, ama Google API Services User
 * Data Policy / Limited Use bölümü kelimesi kelimesine korunmalı.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
      <Link href="/" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
        ← Ana sayfaya dön
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-white">Gizlilik Politikası</h1>
      <p className="mt-1 text-xs text-neutral-500">Son güncelleme: 05.08.2026</p>

      <p className="mt-6">
        LeadLens (&quot;biz&quot;, &quot;hizmet&quot;), web sitenizden gelen form başvurularını Gmail
        hesabınız üzerinden okuyup analiz eden ve satış ekibinize rapor olarak ileten bir otomasyon
        aracıdır. Bu sayfa, hizmeti kullanırken hangi verileri topladığımızı, neden topladığımızı ve
        nasıl koruduğumuzu açıklar.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Topladığımız Veriler</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        <li>
          <strong>Google hesap bilgisi:</strong> &quot;Google ile Bağlan&quot; ile bağlandığınızda, bağlanan
          Gmail adresinizi kimliğiniz olarak kullanırız.
        </li>
        <li>
          <strong>Gmail verisi (sınırlı erişim):</strong> Yalnızca panelde belirlediğiniz konu (subject)
          başlığıyla eşleşen mailleri okur, işlendikten sonra kendi oluşturduğumuz bir etiketle
          işaretleriz. Bu kapsam dışındaki hiçbir mailinizi okumayız. Ayrıca form kopyası ve analiz
          raporu maillerini sizin adınıza gönderebiliriz.
        </li>
        <li>
          <strong>Erişim token&apos;ı:</strong> Gmail erişimini sürdürebilmek için Google&apos;ın verdiği
          yenileme (refresh) token&apos;ını, sunucumuzda AES-256 ile şifrelenmiş olarak saklarız.
        </li>
        <li>
          <strong>Lead verisi:</strong> Web formunuzdan gelen isim, telefon, web sitesi adresi ve mesaj
          içeriği veritabanımızda saklanır.
        </li>
        <li>
          <strong>Ürün kataloğu içeriği:</strong> Panelde eklediğiniz web siteleri/dosyalar taranıp analiz
          amacıyla işlenir.
        </li>
        <li>
          <strong>Ekip üyesi bilgisi:</strong> Panele davet ettiğiniz kişilerin e-posta adresleri.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Verileri Nasıl Kullanırız</h2>
      <p className="mt-2">
        Topladığımız veriler yalnızca şu amaçlarla kullanılır: form başvurularını okuyup lead kaydı
        oluşturmak, web sitenizi/ürün kataloğunuzu analiz ederek uygun ürün önerisi çıkarmak, hazırlanan
        raporu size (ve belirlediğiniz ekip üyelerine) e-posta ile iletmek. Verilerinizi satmayız, kendi
        hizmetimiz dışında pazarlama amacıyla kullanmayız.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Google Kullanıcı Verisi — Sınırlı Kullanım</h2>
      <p className="mt-2">
        LeadLens&apos;in Google API&apos;lerinden aldığı bilgileri kullanımı ve başka herhangi bir
        uygulamaya aktarımı, <strong>Google API Services User Data Policy</strong>&apos;ye (Sınırlı Kullanım
        şartları dahil) uygun olacaktır.
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        LeadLens&apos;s use and transfer to any other app of information received from Google APIs will
        adhere to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Üçüncü Taraf Hizmet Sağlayıcılar</h2>
      <p className="mt-2">
        Hizmeti çalıştırabilmek için şu alt yüklenicilerle çalışırız: barındırma (Vercel), veritabanı
        (Supabase), site taraması (Firecrawl), yapay zeka analizi (Anthropic Claude, OpenAI). Verileriniz
        yalnızca hizmetin çalışması için gerekli ölçüde bu sağlayıcılarla paylaşılır.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Saklama ve Silme</h2>
      <p className="mt-2">
        Lead ve ürün kataloğu verilerinizi panel üzerinden istediğiniz zaman silebilirsiniz. Hesabınızın
        tamamen silinmesini istiyorsanız aşağıdaki e-postadan bize ulaşın — talebiniz makul bir süre
        içinde yerine getirilir. Gmail bağlantınızı kestiğinizde (Google hesap ayarlarınızdan erişimi iptal
        ederek de yapabilirsiniz) saklanan erişim token&apos;ı artık kullanılamaz hale gelir.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">Haklarınız</h2>
      <p className="mt-2">
        KVKK ve ilgili mevzuat kapsamında, verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini
        veya silinmesini isteme haklarına sahipsiniz. Taleplerinizi aşağıdaki e-postadan iletebilirsiniz.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900 dark:text-white">İletişim</h2>
      <p className="mt-2">
        Gizlilikle ilgili sorularınız için:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline dark:text-blue-400">
          {CONTACT_EMAIL}
        </a>
      </p>
    </main>
  );
}
