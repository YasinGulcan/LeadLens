import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAuthorizedForAccount } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Formunuzu bağlayın",
    body: "Web sitenizdeki iletişim/teklif formundan gelen her başvuru otomatik olarak yakalanır — ekstra bir entegrasyon kurmanıza gerek kalmaz.",
  },
  {
    title: "Bilgi tabanınızı oluşturun",
    body: "Web siteniz (sitemap dahil), PDF ya da Excel dosyalarınızdaki ürün/hizmet bilgisi taranıp seçtiğiniz sayfalar vektörlenir.",
  },
  {
    title: "Otomatik analiz ve rapor",
    body: "Her yeni lead bilgi tabanınızla eşleştirilir, yapay zekayla puanlanır ve ekibinize Gmail üzerinden hazır bir rapor olarak gelir.",
  },
];

const FEATURES = [
  { title: "Otomatik Gmail Entegrasyonu", body: "Raporlar sizin Gmail hesabınızdan gönderilir — ayrı bir e-posta servisi kurmanıza gerek yok." },
  { title: "Web, PDF, Excel'den Bilgi Tabanı", body: "Sitenizin sitemap'inden istediğiniz sayfaları seçin, dosya yükleyin — hepsi otomatik taranıp vektörlenir." },
  { title: "Yapay Zeka Destekli Puanlama", body: "Her lead, bilgi tabanınızla eşleştirilip önceliklendirilir; ekibiniz en değerli fırsatlara önce bakar." },
  { title: "Ekip Yönetimi", body: "Ekip arkadaşlarınızı davet edin, kimin ne göreceğini ve neyi silebileceğini siz kontrol edin." },
  { title: "Şifre Yok, Google ile Güvenli Giriş", body: "Ayrı bir kullanıcı adı/şifre yönetmenize gerek yok — hesabınız Google kimliğinizle korunur." },
  { title: "KVKK'ya Duyarlı", body: "Form sayfanızda hazır bir aydınlatma metni ve açık rıza kutusu ile başlarsınız." },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connectError?: string }>;
}) {
  const { connectError } = await searchParams;

  const session = await getSessionInfo();
  if (session) {
    const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", session.accountId).single();
    // Hesap hâlâ varsa VE bu e-posta hâlâ yetkiliyse yönlendir; hesap
    // silinmişse ya da (ör. ekipten çıkarıldıysa) artık yetkili değilse
    // hiçbir yere yönlendirmeden burada normal giriş ekranını göster —
    // aksi halde /dashboard'un/onboarding'in kendi kontrolüyle sonsuz
    // yönlendirme döngüsü oluşur.
    if (account && (await isAuthorizedForAccount(session.accountId, session.email))) {
      redirect(account.onboarded_at ? "/dashboard" : "/onboarding");
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold">LeadLens</span>
        <a
          href="/api/oauth/gmail/start"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Giriş Yap
        </a>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-12 pb-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Gelen lead&apos;leriniz, siz bakmadan önce analiz edilsin.
        </h1>
        <p className="mt-5 max-w-xl text-base text-neutral-500 sm:text-lg">
          Web formunuzdan gelen her başvuru otomatik olarak ürün bilgi tabanınızla eşleştirilir, yapay zekayla
          puanlanır ve ekibinize hazır bir rapor olarak gelir.
        </p>

        {connectError && (
          <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {connectError}
          </p>
        )}

        <a
          href="/api/oauth/gmail/start"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Google ile Bağlan
        </a>
        <p className="mt-3 text-xs text-neutral-400">Ücretsiz başlayın — kredi kartı gerekmez.</p>
      </section>

      {/* Nasıl çalışır */}
      <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <div className="mx-auto w-full max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold">Nasıl çalışır</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-neutral-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Özellikler */}
      <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <div className="mx-auto w-full max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold">Neler sunuyor</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-neutral-500">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Giriş alanı */}
      <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-xl border border-neutral-200 px-8 py-10 text-center dark:border-neutral-800">
          <h2 className="text-xl font-bold">Hemen başlayın</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Google hesabınızla saniyeler içinde giriş yapın ya da yeni bir hesap oluşturun. Ayrı bir kullanıcı
            adı/şifre yok.
          </p>
          <a
            href="/api/oauth/gmail/start"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Google ile Bağlan
          </a>
          <p className="mt-3 text-xs text-neutral-400">
            Gmail hesabınızı bağlayarak hesabınızı oluşturur ya da mevcut hesabınıza giriş yaparsınız.
          </p>
        </div>
      </section>

      <footer className="mt-auto border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-6 text-xs text-neutral-400 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} LeadLens</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">
              Gizlilik Politikası
            </Link>
            <Link href="/terms" className="hover:underline">
              Hizmet Şartları
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
