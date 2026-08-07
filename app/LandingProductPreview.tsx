import { Phone, Mail, Globe } from "lucide-react";
import { Badge, ScoreCircle } from "@/components/ui";

const MOCK_SCORES = [
  { label: "İhtimal Uyumu", score: 82 },
  { label: "Niyet Gücü", score: 74 },
  { label: "Aciliyet", score: 65 },
];

function scoreOpacity(score: number): number {
  return 0.35 + (score / 100) * 0.65;
}

/**
 * Landing sayfasındaki "ürün görseli" — gerçek bir ekran görüntüsü dosyası
 * yerine, gerçek tasarım sistemi bileşenleriyle (Card/Badge/ScoreCircle)
 * kurulu, örnek/sahte verili statik bir mockup. Böylece panel gerçekten
 * değişse bile bu görsel asla tasarımdan sapmaz. Örnek isim/site bilinçli
 * olarak jenerik — gerçek bir müşteri verisi değil.
 */
export function LandingProductPreview() {
  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
      {/* Sahte tarayıcı başlığı */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-hover/60 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
          leadlens.app/dashboard/leads/…
        </span>
      </div>

      {/* Kart içeriği */}
      <div className="p-6 text-left">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold text-muted-foreground">
            AY
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-bold text-foreground">Ayşe Yılmaz</h3>
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

        <div className="mt-5 flex items-center gap-4 border-t border-border pt-5">
          <ScoreCircle score={0.82} size="lg" />
          <div>
            <p className="text-sm font-medium text-foreground">Skor: 82/100</p>
            <p className="text-xs text-muted-foreground">SEO Paketi Pro ile eşleşti</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {MOCK_SCORES.map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-foreground">{s.label}</span>
                <span className="text-muted-foreground">{s.score}/100</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.score}%`, backgroundColor: "var(--accent)", opacity: scoreOpacity(s.score) }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Site bulgusu: </span>
          Ürün sayfalarında müşteri yorumu/referans bulunmuyor, blog/içerik pazarlaması yok.
        </p>
      </div>
    </div>
  );
}
