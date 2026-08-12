"use client";

import { useEffect, useRef, useState } from "react";
import { User, Phone, Mail, Globe, MessageSquare, Search, Loader2, ChevronDown } from "lucide-react";
import { Badge, ScoreCircle } from "@/components/ui";
import { ScoreBreakdown, type ScoreBreakdownData } from "./dashboard/ScoreBreakdown";

const DEMO_NAME = "Ayşe Yılmaz";
const DEMO_MESSAGE = "Merhaba, ürünleriniz hakkında bilgi almak istiyorum, uygun bir paket önerebilir misiniz?";
const STEP_DURATIONS_MS = [4200, 2600, 9500] as const;
const ANALYZE_MESSAGES = ["Site taranıyor...", "Ürünlerle eşleştiriliyor...", "Skorlanıyor..."];

const DEMO_FIELDS = [
  { icon: Phone, value: "0532 xxx xx xx", delayMs: 900 },
  { icon: Mail, value: "ayse@ornek.com", delayMs: 1300 },
  { icon: Globe, value: "ornekfirma.com", delayMs: 1700 },
  { icon: MessageSquare, value: DEMO_MESSAGE, delayMs: 2100 },
];

const DEMO_BREAKDOWN: ScoreBreakdownData = {
  fit: { score: 82, reason: "Web sitesi profili ve talep edilen hizmet, hedef müşteri segmentiyle örtüşüyor." },
  intent: { score: 74, reason: "Net bir ürün/paket talebi var, kararlı bir dil kullanılmış." },
  value: { score: 58, reason: "Bütçe ya da ekip büyüklüğüne dair somut bir sinyal yok, orta ölçekli bir fırsat gibi görünüyor." },
  urgency: { score: 65, reason: "Kısa vadeli bir baskı ifade edilmemiş ama aktif olarak paket arıyor." },
};
const DEMO_OVERALL_SCORE = 0.82;

const CALLOUTS = [
  { text: "0-100 arası otomatik puanlama", delayMs: 300 },
  { text: "AI aramalarında markanız geçiyor mu, otomatik kontrol edilir", delayMs: 1200 },
  { text: "İhtimal, niyet, değer, aciliyet ayrı ayrı ölçülür", delayMs: 4200 },
  { text: "Sitenizi tarayıp eksikleri otomatik tespit eder", delayMs: 5200 },
];

/**
 * Landing sayfasındaki "ürün görseli" — gerçek bir ekran görüntüsü ya da
 * gerçek bir API çağrısı değil, 3 adımda kendi kendine ilerleyen TAMAMEN
 * SAHTE/SCRIPTED bir demo döngüsü (form doldurma → analiz → sonuç → başa
 * dön). Tüm veriler sabit örnek verilerdir. Skor kırılımı, panelde gerçek
 * lead detayında kullanılan `ScoreBreakdown` component'inin ta kendisi
 * (sahte veriyle) — böylece panelin tasarımı değişirse demo da otomatik
 * senkron kalır. Adım geçişleri kendi kendini zamanlayan bir setTimeout
 * zinciriyle yürür, ekstra bir animasyon kütüphanesi kullanılmaz.
 */
export function LandingDemoPreview() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    function run(current: 0 | 1 | 2) {
      const timer = setTimeout(() => {
        const next = ((current + 1) % 3) as 0 | 1 | 2;
        setStep(next);
        run(next);
      }, STEP_DURATIONS_MS[current]);
      timers.push(timer);
    }
    run(0);
    return () => timers.forEach(clearTimeout);
  }, []);

  // Sonuç adımının içeriği kutunun sabit yüksekliğinden uzun — widget'ın
  // dış boyutu adımlar arasında hiç değişmesin diye (aksi halde her
  // geçişte sayfa zıplar) kutu sabit kalır, içerik kendi içinde yavaşça
  // aşağı kayarak okunur.
  useEffect(() => {
    if (step !== 2) return;
    const el = contentRef.current;
    if (!el) return;
    let raf = 0;
    const startDelay = setTimeout(() => {
      const startTime = performance.now();
      const startTop = el.scrollTop;
      const distance = el.scrollHeight - el.clientHeight - startTop;
      const duration = 3000;
      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        el.scrollTop = startTop + distance * eased;
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      if (distance > 0) raf = requestAnimationFrame(tick);
    }, 3500);
    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(raf);
    };
  }, [step]);

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-3 flex justify-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-accent" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border bg-surface-hover/60 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
            {step === 0 ? "leadlens.app/form/…" : "leadlens.app/dashboard/leads/…"}
          </span>
        </div>

        <div
          key={step}
          ref={contentRef}
          className={`landing-demo-fade h-[580px] p-6 text-left ${step === 2 ? "overflow-y-auto" : "overflow-hidden"}`}
        >
          {step === 0 && <StepInput />}
          {step === 1 && <StepAnalyzing />}
          {step === 2 && <StepResult />}
        </div>
      </div>

      <style>{`
        @keyframes landingDemoFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-demo-fade { animation: landingDemoFadeIn 0.4s ease; }
        .landing-demo-field-in { animation: landingDemoFadeIn 0.35s ease both; }

        @keyframes landingDemoBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .landing-demo-caret { animation: landingDemoBlink 1s step-end infinite; }

        @keyframes landingDemoCalloutIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .landing-demo-callout { animation: landingDemoCalloutIn 0.4s ease both; }
      `}</style>
    </div>
  );
}

function StepInput() {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(DEMO_NAME.slice(0, i));
      if (i >= DEMO_NAME.length) clearInterval(iv);
    }, 70);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Web formunuz dolduruluyor</p>

      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5">
        <User size={14} className="shrink-0 text-muted-foreground" />
        <span className="text-sm text-foreground">
          {typed}
          <span className="landing-demo-caret ml-0.5 inline-block h-4 w-px align-middle bg-foreground" />
        </span>
      </div>

      {DEMO_FIELDS.map(({ icon: Icon, value, delayMs }) => (
        <div
          key={value}
          className="landing-demo-field-in flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2.5"
          style={{ animationDelay: `${delayMs}ms` }}
        >
          <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="text-sm text-foreground">{value}</span>
        </div>
      ))}

      <button
        type="button"
        disabled
        className="landing-demo-field-in pointer-events-none mt-1 w-full rounded-md bg-accent/40 px-6 py-2.5 text-sm font-medium text-white"
        style={{ animationDelay: "2500ms" }}
      >
        Analiz Et
      </button>
    </div>
  );
}

function StepAnalyzing() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, ANALYZE_MESSAGES.length - 1));
    }, 900);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <Loader2 size={28} className="animate-spin text-accent" />
      <p key={msgIndex} className="landing-demo-fade text-sm font-medium text-foreground">
        {ANALYZE_MESSAGES[msgIndex]}
      </p>
    </div>
  );
}

function Callout({ text, delayMs }: { text: string; delayMs: number }) {
  return (
    <span
      className="landing-demo-callout absolute -top-3 right-2 z-10 hidden items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent shadow-sm sm:right-4 sm:flex"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <ChevronDown size={10} className="shrink-0" />
      {text}
    </span>
  );
}

function MobileCalloutCycler() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setI((v) => (v + 1) % CALLOUTS.length), 1800);
    return () => clearInterval(iv);
  }, []);

  return (
    <p key={i} className="landing-demo-fade mt-4 text-center text-[11px] font-medium text-accent sm:hidden">
      {CALLOUTS[i].text}
    </p>
  );
}

function StepResult() {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold text-muted-foreground">
          AY
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-lg font-bold text-foreground">{DEMO_NAME}</h3>
            <Badge variant="accent">Görüşme Ayarlandı</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone size={12} /> 0532 xxx xx xx
            </span>
            <span className="flex items-center gap-1">
              <Mail size={12} /> ayse@ornek.com
            </span>
            <span className="flex items-center gap-1">
              <Globe size={12} /> ornekfirma.com
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Müşteri Mesajı</h4>
        <p className="text-sm text-foreground">{DEMO_MESSAGE}</p>
      </div>

      <div className="relative mt-5 flex items-center gap-4 border-t border-border pt-5">
        <ScoreCircle score={DEMO_OVERALL_SCORE} size="lg" />
        <div>
          <p className="text-sm font-medium text-foreground">Skor: 82/100 — SEO Paketi Pro ile eşleşti</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            İçerik pazarlaması ve arama görünürlüğü zayıf — bu paket doğrudan bu boşluğu kapatıyor.
          </p>
        </div>
        <Callout text={CALLOUTS[0].text} delayMs={CALLOUTS[0].delayMs} />
      </div>

      <div className="relative mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Search size={12} className="shrink-0" />
        <span>
          &quot;ofis mobilyası&quot; araması — AI görünürlüğü: <span className="font-medium text-danger">marka geçmedi</span>
        </span>
        <Callout text={CALLOUTS[1].text} delayMs={CALLOUTS[1].delayMs} />
      </div>

      <div className="relative mt-5 border-t border-border pt-5">
        <ScoreBreakdown breakdown={DEMO_BREAKDOWN} overallScore={DEMO_OVERALL_SCORE} />
        <Callout text={CALLOUTS[2].text} delayMs={CALLOUTS[2].delayMs} />
      </div>

      <div className="relative mt-5">
        <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Site bulgusu: </span>
          Ürün sayfalarında müşteri yorumu/referans bulunmuyor, blog/içerik pazarlaması yok.
        </p>
        <Callout text={CALLOUTS[3].text} delayMs={CALLOUTS[3].delayMs} />
      </div>

      <MobileCalloutCycler />
    </div>
  );
}
