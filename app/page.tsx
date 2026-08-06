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

/** Google'ın resmi çok renkli "G" amblemi — "___ ile devam et" düğmelerinde marka tanınırlığı için standart kullanım. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

/** Google'ın kendi marka kurallarına uygun, tanıdık "___ ile devam et" düğme stili — beyaz zemin, ince kenarlık, çok renkli "G". */
function GoogleButton({ className = "" }: { className?: string }) {
  return (
    <a
      href="/api/oauth/gmail/start"
      className={`inline-flex items-center justify-center gap-3 rounded-md border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:shadow-md dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 ${className}`}
    >
      <GoogleLogo />
      Google ile Bağlan
    </a>
  );
}

/**
 * "Giriş Yap" ve "Kayıt Ol" ayrı görünse de ikisi de aynı tek akışa (Google
 * OAuth) çıkıyor — sistemde ayrı bir şifre/kayıt formu yok. Tıklayınca küçük
 * bir panelde gerçek CTA'yı gösteriyor. Native <details>/<summary>
 * kullanıldığı için client component gerekmiyor.
 */
function AuthMenuButton({ label, className }: { label: string; className: string }) {
  return (
    <details className="relative">
      <summary
        className={`list-none cursor-pointer marker:hidden [&::-webkit-details-marker]:hidden ${className}`}
      >
        {label}
      </summary>
      <div className="absolute right-0 z-10 mt-3 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-t border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
        <p className="relative mb-3 text-xs text-neutral-500">Devam etmek için Google hesabınızla bağlanın</p>
        <GoogleButton className="relative w-full" />
      </div>
    </details>
  );
}

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
        <div className="flex items-center gap-2">
          <AuthMenuButton
            label="Giriş Yap"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          />
          <AuthMenuButton
            label="Kayıt Ol"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          />
        </div>
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

        <GoogleButton className="mt-8" />
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
          <GoogleButton className="mt-6 w-full" />
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
