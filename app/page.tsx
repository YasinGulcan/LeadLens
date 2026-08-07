import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Sparkles, Send, Gauge, Layers, Eye, Mail, ShieldCheck, Lock, Users, AlertCircle } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { isAuthorizedForAccount } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui";
import { GoogleButton } from "./GoogleButton";
import { AuthMenu } from "./AuthMenu";
import { LandingProductPreview } from "./LandingProductPreview";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: FileText,
    title: "Form dolduruluyor",
    body: "Müşteriniz web sitenizdeki iletişim/teklif formunu dolduruyor — ekstra bir entegrasyon kurmanıza gerek kalmaz.",
  },
  {
    icon: Sparkles,
    title: "Otomatik analiz",
    body: "Site taranıyor, ürün kataloğunuzla eşleştiriliyor ve yapay zeka tarafından fit/niyet/değer/aciliyet kırılımıyla skorlanıyor.",
  },
  {
    icon: Send,
    title: "Hazır raporla satışa gidiyor",
    body: "Ekibiniz skor, sektör, önerilen ürün ve satış temsilcisinin sorması gereken netleştirici soruyla birlikte lead'i alıyor.",
  },
];

const FEATURES = [
  {
    icon: Gauge,
    title: "Otomatik Skor",
    body: "Her lead; ihtimal uyumu, niyet gücü, talepteki değer ve aciliyet olmak üzere 4 ayrı boyutta puanlanır.",
  },
  {
    icon: Layers,
    title: "Ürün Eşleştirme",
    body: "Sitenizden veya yüklediğiniz dosyalardan taranan bilgi tabanınızla, müşteri talebine en uygun ürün/hizmet otomatik önerilir.",
  },
  {
    icon: Eye,
    title: "AI Görünürlük Kontrolü",
    body: "Sitenizin gerçek bir web aramasında ve yapay zeka sonuçlarında ne kadar görünür olduğu ölçülüp rapora eklenir.",
  },
  {
    icon: Mail,
    title: "Hazır Yanıt Taslağı",
    body: "İsterseniz, satış ekibiniz adına düzenlenebilir bir e-posta taslağı üretilir — tek tıkla kopyalanır ya da gönderilir.",
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
    <main className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-bold text-foreground">LeadLens</span>
          <AuthMenu />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-14 pb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Gelen lead&apos;leriniz, siz bakmadan önce analiz edilsin.
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Web formunuzdan gelen her başvuru otomatik olarak ürün bilgi tabanınızla eşleştirilir, yapay zekayla
          puanlanır ve ekibinize hazır bir rapor olarak gelir.
        </p>

        {connectError && (
          <p className="mt-6 flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {connectError}
          </p>
        )}

        <GoogleButton className="mt-8" />
        <p className="mt-3 text-xs text-muted-foreground">Ücretsiz başlayın — kredi kartı gerekmez.</p>
      </section>

      {/* Ürün görseli */}
      <section className="mx-auto flex w-full max-w-5xl justify-center px-6 pb-20">
        <LandingProductPreview />
      </section>

      {/* Nasıl çalışır */}
      <section className="border-t border-border py-16">
        <div className="mx-auto w-full max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold text-foreground">Nasıl çalışır</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <Icon size={20} className="text-accent" />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Özellikler */}
      <section className="border-t border-border py-16">
        <div className="mx-auto w-full max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold text-foreground">Neler sunuyor</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-3 font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Erişim ve Gizlilik */}
      <section className="border-t border-border py-16">
        <div className="mx-auto w-full max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold text-foreground">Erişim ve Gizlilik</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-5">
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

      {/* Giriş alanı */}
      <section className="border-t border-border py-16">
        <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-xl border border-border bg-surface px-8 py-10 text-center">
          <h2 className="text-xl font-bold text-foreground">Hemen başlayın</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Google hesabınızla saniyeler içinde giriş yapın ya da yeni bir hesap oluşturun. Ayrı bir kullanıcı
            adı/şifre yok.
          </p>
          <GoogleButton className="mt-6 w-full" />
          <p className="mt-3 text-xs text-muted-foreground">
            Gmail hesabınızı bağlayarak hesabınızı oluşturur ya da mevcut hesabınıza giriş yaparsınız.
          </p>
        </div>
      </section>

      <footer className="mt-auto border-t border-border py-8">
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
