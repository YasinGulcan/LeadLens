import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Sparkles, Send, Gauge, Layers, Eye, Mail, ShieldCheck, Lock, Users, AlertCircle, ChevronDown } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { resolveAuthenticatedDestination } from "@/lib/auth-redirect";
import { getActivePricingPlans } from "@/lib/pricing";
import { Card } from "@/components/ui";
import { AuthMenu } from "./AuthMenu";
import { LandingDemoPreview } from "./LandingDemoPreview";
import { PanelPreview } from "./PanelPreview";
import { PricingSection } from "./PricingSection";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: FileText,
    title: "Form dolsun",
    body: "Müşteriniz web sitenizdeki iletişim/teklif formunu dolduruyor — ekstra bir entegrasyon kurmanıza gerek kalmaz.",
  },
  {
    icon: Sparkles,
    title: "Analiz otomatik çalışsın",
    body: "Site taranıyor, ürün kataloğunuzla eşleştiriliyor ve yapay zeka tarafından fit/niyet/değer/aciliyet kırılımıyla skorlanıyor.",
  },
  {
    icon: Send,
    title: "Rapor satışa düşsün",
    body: "Ekibiniz skor, sektör, önerilen ürün ve satış temsilcisinin sorması gereken netleştirici soruyla birlikte lead'i alıyor.",
  },
];

const FEATURES = [
  {
    icon: Gauge,
    title: "Otomatik Skor",
    body: "Her lead; ihtimal uyumu, niyet gücü, talepteki değer ve aciliyet olmak üzere 4 ayrı boyutta puanlanır.",
    featured: true,
  },
  {
    icon: Layers,
    title: "Ürün Eşleştirme",
    body: "Sitenizden veya yüklediğiniz dosyalardan taranan bilgi tabanınızla, müşteri talebine en uygun ürün/hizmet otomatik önerilir.",
    featured: false,
  },
  {
    icon: Eye,
    title: "AI Görünürlük Kontrolü",
    body: "Sitenizin gerçek bir web aramasında ve yapay zeka sonuçlarında ne kadar görünür olduğu ölçülüp rapora eklenir.",
    featured: true,
  },
  {
    icon: Mail,
    title: "Hazır Yanıt Taslağı",
    body: "İsterseniz, satış ekibiniz adına düzenlenebilir bir e-posta taslağı üretilir — tek tıkla kopyalanır ya da gönderilir.",
    featured: false,
  },
];

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Yalnızca belirlediğiniz başlıklar işlenir",
    body: "Gmail'inizde filtrelerinizle eşleşmeyen hiçbir mail okunmaz/işlenmez.",
  },
  {
    icon: Lock,
    title: "Bilgi tabanınız yalnızca sizin analizlerinizde kullanılır",
    body: "Başka hesaplarla paylaşılmaz, model eğitiminde kullanılmaz.",
  },
  {
    icon: Users,
    title: "Davet etmediğiniz kimse hesabınıza erişemez",
    body: "Silme işlemleri ve ekip yönetimi yalnızca hesap sahibinde.",
  },
];

const FAQ_ITEMS = [
  {
    q: "LeadLens hangi işletmeler için uygun?",
    a: "B2B satış süreci olan işletmeler için tasarlandı — ajanslar, yazılım/SaaS şirketleri, toptan satışçılar ve B2B hizmet sağlayıcıları gibi. Web formunuzdan gelen talepleri elle inceleyip önceliklendirmek yerine bu işi otomatik yaptırmak istiyorsanız tam size göre.",
  },
  {
    q: "E-ticaret sitem var, bana uygun mu?",
    a: "Odağımız, form doldurup görüşme veya teklif bekleyen B2B/danışmanlık ağırlıklı satış süreçleri — anlık sepet/ödeme akışı olan klasik e-ticaretten çok, iletişim formu üzerinden talep alan işletmelere uygun.",
  },
  {
    q: "Kurulum ne kadar sürer?",
    a: "Kurulum Paneli'ndeki 4 adımı (mail kaynağı, filtreler, bilgi tabanı, profil) tamamlamak ortalama 5-10 dakika sürer. Her adımda ne yapmanız gerektiği ve neden gerekli olduğu ayrı ayrı açıklanır.",
  },
  {
    q: "Gmail dışında bir mail sağlayıcım var, kullanabilir miyim?",
    a: "Şu an için LeadLens Gmail üzerinden çalışıyor; farklı bir mail adresine gelen talepleri yönlendirebileceğiniz bir seçenek yakında ekleniyor.",
  },
  {
    q: "Verilerim güvende mi, Gmail'ime tam erişim mi veriyorum?",
    a: "Hayır — yalnızca sizin belirlediğiniz filtrelerle eşleşen mailler okunur. Bilgi tabanınız başka hesaplarla paylaşılmaz ya da model eğitiminde kullanılmaz; silme işlemleri ve ekip yönetimi yalnızca hesap sahibinde kalır.",
  },
  {
    q: "Ücretsiz deneme sonunda ne olur?",
    a: "14 günlük deneme boyunca kredi kartı istenmez ve tüm özellikler açıktır. Deneme süresi bittiğinde herhangi bir kısıtlama uygulanmaz — dilediğinizde bir plan seçerek devam edebilirsiniz.",
  },
  {
    q: "İstediğim zaman iptal edebilir miyim?",
    a: "Evet, uzun vadeli bir taahhüt yok. Dilediğiniz zaman hesabınızı Ayarlar'dan kendiniz silebilirsiniz.",
  },
  {
    q: "Ekibimle birlikte kullanabilir miyim?",
    a: "Evet — ekip üyelerinizi davet edebilir, gelen lead'leri kişilere atayabilirsiniz; herkesin kendi performansını ve aktivite geçmişini gösteren bir profil sayfası olur.",
  },
];

/** Bölüm başlıklarının üstündeki küçük vurgu etiketi — tipografi hiyerarşisine bir kademe daha ekler. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold tracking-wider text-accent uppercase">{children}</p>;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connectError?: string; accountDeleted?: string }>;
}) {
  const { connectError, accountDeleted } = await searchParams;
  const pricingPlans = await getActivePricingPlans();

  const session = await getSessionInfo();
  if (session) {
    const destination = await resolveAuthenticatedDestination(session);
    if (destination) redirect(destination);
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-bold text-foreground">LeadLens</span>
          <AuthMenu />
        </div>
      </header>

      {/* Hero — header'daki AuthMenu ile başlık arasında bilinçli olarak geniş boşluk bırakılıyor */}
      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-28 pb-10 text-center sm:pt-32">
        {/* Marka imzası — çok hafif, dikkat dağıtmayan bir accent doku; şablon değil LeadLens hissi versin diye */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{ background: "radial-gradient(ellipse 900px 500px at 15% 0%, var(--accent), transparent 65%)" }}
        />
        <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Gelen lead&apos;leriniz, siz bakmadan önce analiz edilsin.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Web formunuzdan gelen her başvuru otomatik olarak ürün bilgi tabanınızla eşleştirilir, yapay zekayla
          puanlanır ve ekibinize hazır bir rapor olarak gelir.
        </p>

        {connectError && (
          <p className="mt-6 flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {connectError}
          </p>
        )}

        {accountDeleted && (
          <p className="mt-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground">
            Hesabınız silindi.
          </p>
        )}

        <Link
          href="/signup"
          className="mt-8 inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Ücretsiz Kayıt Olun
        </Link>
      </section>

      {/* Ürün görseli */}
      <section className="mx-auto flex w-full max-w-5xl justify-center px-6 pt-4 pb-12">
        <LandingDemoPreview />
      </section>

      {/* Paneli incele — kendi kendine oynayan senaryonun aksine, ziyaretçinin kendi tıklayarak gezdiği sahte bir leadler listesi */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-16">
        <div className="text-center">
          <Eyebrow>Panel</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Paneli inceleyin</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Örnek lead&apos;lere tıklayıp gerçek panelde neyle karşılaşacağınızı görün.
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <PanelPreview />
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section className="bg-surface py-16 sm:py-20">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="text-center">
            <Eyebrow>Süreç</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Nasıl çalışır</h2>
          </div>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Özellikler */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="text-center">
            <Eyebrow>Özellikler</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Neler sunuyor</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className={`p-5 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg ${
                    feature.featured
                      ? "border-accent/30 shadow-md shadow-accent/5 hover:border-accent/60"
                      : "hover:border-accent/40"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-accent ${
                      feature.featured ? "bg-accent/15" : "bg-accent/10"
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-3.5 text-[15px] font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Fiyatlandırma — platform admin Ayarlar > Fiyatlandırma'dan yönetir (bkz. lib/pricing.ts); hiç aktif plan yoksa bölüm hiç render edilmez. */}
      {pricingPlans.length > 0 && (
        <section className="border-t border-border bg-background py-16 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="text-center">
              <Eyebrow>Fiyatlandırma</Eyebrow>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Size uygun planı seçin</h2>
            </div>
            <PricingSection plans={pricingPlans} />
          </div>
        </section>
      )}

      {/* Erişim ve Gizlilik */}
      <section className="bg-surface py-16 sm:py-20">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="text-center">
            <Eyebrow>Güvenlik</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Erişim ve Gizlilik</h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="p-5 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon size={18} />
                  </span>
                  <p className="mt-3 text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sıkça Sorulan Sorular — native <details>/<summary>, ekstra JS gerekmez; her soru bağımsız açılıp kapanır. */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="text-center">
            <Eyebrow>SSS</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Sıkça Sorulan Sorular</h2>
          </div>
          <Card className="mx-auto mt-12 max-w-2xl divide-y divide-border">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-medium text-foreground">{item.q}</span>
                  <ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </Card>
        </div>
      </section>

      {/* Hemen başlayın */}
      <section className="bg-surface py-16 sm:py-20">
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 text-center">
          <h2 className="text-xl font-bold text-foreground">Hemen başlayın</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ad soyad, telefon ve e-postanızla saniyeler içinde başlayın. Ayrı bir şifre oluşturmanıza gerek yok —
            e-postanıza gönderilecek kodla giriş yaparsınız.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Ücretsiz Kayıt Olun
          </Link>
        </div>
      </section>

      <footer className="mt-auto border-t border-border bg-surface py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} LeadLens</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              Gizlilik Politikası
            </Link>
            <Link href="/terms" className="hover:text-foreground hover:underline">
              Hizmet Şartları
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
