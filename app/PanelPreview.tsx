"use client";

import { useState } from "react";
import { Phone, Mail, Globe, ArrowLeft, Search } from "lucide-react";
import { Badge, ScoreCircle, ScoreBadge } from "@/components/ui";
import { ScoreBreakdown, type ScoreBreakdownData } from "./dashboard/ScoreBreakdown";

interface DemoLead {
  id: string;
  name: string;
  initials: string;
  sector: string;
  status: string;
  statusVariant: "accent" | "success" | "neutral" | "danger";
  phone: string;
  email: string;
  website: string;
  message: string;
  score: number;
  recommendedProduct: string;
  siteFinding: string;
  breakdown: ScoreBreakdownData;
}

const DEMO_LEADS: DemoLead[] = [
  {
    id: "1",
    name: "Elif Kara",
    initials: "EK",
    sector: "E-ticaret",
    status: "Satışa Gönderildi",
    statusVariant: "success",
    phone: "0533 xxx xx xx",
    email: "elif@kara-tekstil.com",
    website: "kara-tekstil.com",
    message: "Merhaba, kurumsal paketinizle ilgili teklif almak istiyoruz, mağazamız büyüyor.",
    score: 0.91,
    recommendedProduct: "Kurumsal Paket",
    siteFinding: "Ürün sayfaları güçlü ama canlı destek/chat entegrasyonu yok — bu paketin tam çözdüğü boşluk.",
    breakdown: {
      fit: { score: 92, reason: "Sektör ve site profili kurumsal pakete birebir uyuyor." },
      intent: { score: 88, reason: "Doğrudan teklif talep etmiş, net bir satın alma niyeti var." },
      value: { score: 90, reason: "Site trafiği ve ürün hacmi büyük bir fırsata işaret ediyor." },
      urgency: { score: 74, reason: "\"Büyüyoruz\" ifadesi kısa vadeli bir ihtiyacı gösteriyor." },
    },
  },
  {
    id: "2",
    name: "Burak Şahin",
    initials: "BŞ",
    sector: "Danışmanlık",
    status: "Görüşme Ayarlandı",
    statusVariant: "accent",
    phone: "0542 xxx xx xx",
    email: "burak@sahin-danismanlik.com",
    website: "sahin-danismanlik.com",
    message: "Web sitemiz eski kaldı, hem tasarım hem SEO tarafında destek arıyoruz.",
    score: 0.76,
    recommendedProduct: "SEO Paketi Pro",
    siteFinding: "Site son 2 yıldır güncellenmemiş, blog/içerik üretimi hiç yok.",
    breakdown: {
      fit: { score: 80, reason: "Talep edilen hizmetler ürün kataloğuyla doğrudan örtüşüyor." },
      intent: { score: 70, reason: "İhtiyaç net ama henüz bir bütçe/zaman çerçevesi belirtilmemiş." },
      value: { score: 68, reason: "Küçük-orta ölçekli bir işletme, orta büyüklükte bir fırsat." },
      urgency: { score: 55, reason: "Aciliyet belirtilmemiş, keşif aşamasında görünüyor." },
    },
  },
  {
    id: "3",
    name: "Merve Aydın",
    initials: "MA",
    sector: "Yazılım / SaaS",
    status: "Yeni",
    statusVariant: "neutral",
    phone: "0555 xxx xx xx",
    email: "merve@aydinsoft.io",
    website: "aydinsoft.io",
    message: "Ürün görünürlüğümüzü artırmak istiyoruz, fiyatlandırma hakkında bilgi alabilir miyiz?",
    score: 0.58,
    recommendedProduct: "AI Görünürlük Analizi",
    siteFinding: "Marka adı AI arama sonuçlarında hiç geçmiyor, rakipler öne çıkıyor.",
    breakdown: {
      fit: { score: 65, reason: "Görünürlük ihtiyacı ürün kapsamında ama tam eşleşme değil." },
      intent: { score: 52, reason: "Sadece fiyat soruyor, henüz karar aşamasında değil." },
      value: { score: 48, reason: "Erken aşama bir SaaS, bütçe belirsiz." },
      urgency: { score: 40, reason: "Herhangi bir zaman baskısı ifade edilmemiş." },
    },
  },
  {
    id: "4",
    name: "Kerem Doğan",
    initials: "KD",
    sector: "Emlak",
    status: "Kaybedildi",
    statusVariant: "danger",
    phone: "0505 xxx xx xx",
    email: "kerem@dogan-emlak.com",
    website: "dogan-emlak.com",
    message: "Sadece bilgi almak istemiştim, şimdilik bir adım atmayacağız.",
    score: 0.29,
    recommendedProduct: "—",
    siteFinding: "Site aktif ve güncel, kısa vadede ek bir ihtiyaç görünmüyor.",
    breakdown: {
      fit: { score: 35, reason: "Sektör uyumlu ama ürün kapsamıyla zayıf örtüşüyor." },
      intent: { score: 20, reason: "Açıkça \"şimdilik adım atmayacağız\" demiş." },
      value: { score: 30, reason: "Küçük ölçekli, düşük öncelikli bir fırsat." },
      urgency: { score: 15, reason: "Hiçbir aciliyet sinyali yok." },
    },
  },
];

/**
 * Landing sayfasındaki "Paneli İncele" — LandingDemoPreview'in aksine
 * (kendi kendine oynayan, TEK bir lead'in senaryosu) burası ziyaretçinin
 * kendi tıklayarak gezdiği, TAMAMEN SAHTE bir leadler listesi + lead detayı.
 * Hiçbir backend çağrısı yok, tüm veriler sabit. Skor kırılımı gerçek
 * `ScoreBreakdown` component'i (panelle otomatik senkron kalsın diye).
 */
export function PanelPreview() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = DEMO_LEADS.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="w-full max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border bg-surface-hover/60 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
            leadlens.app/dashboard/leads{selected ? `/${selected.id}` : ""}
          </span>
        </div>

        <div className="h-[520px] overflow-y-auto p-5 text-left">
          {!selected ? (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-foreground">Lead&apos;ler</h3>
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  <Search size={12} />
                  İsim, sektör ara...
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-hover text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">İsim</th>
                      <th className="px-3 py-2 font-medium">Skor</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {DEMO_LEADS.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedId(lead.id)}
                        className="cursor-pointer transition-colors hover:bg-surface-hover/60"
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-foreground">{lead.name}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">— {lead.sector}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <ScoreBadge score={lead.score} size="sm" />
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <Badge variant={lead.statusVariant}>{lead.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Bir satıra tıklayıp detayına gidebilirsiniz — gerçek panelde olduğu gibi.
              </p>
            </div>
          ) : (
            <div className="landing-panel-fade">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-4 flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <ArrowLeft size={12} /> Lead&apos;ler
              </button>

              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold text-muted-foreground">
                  {selected.initials}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-lg font-bold text-foreground">{selected.name}</h3>
                    <Badge variant={selected.statusVariant}>{selected.status}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {selected.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail size={12} /> {selected.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe size={12} /> {selected.website}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-5">
                <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Müşteri Mesajı</h4>
                <p className="text-sm text-foreground">{selected.message}</p>
              </div>

              <div className="mt-5 flex items-center gap-4 border-t border-border pt-5">
                <ScoreCircle score={selected.score} size="lg" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Skor: {Math.round(selected.score * 100)}/100 — {selected.recommendedProduct}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{selected.siteFinding}</p>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-5">
                <ScoreBreakdown breakdown={selected.breakdown} overallScore={selected.score} />
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes landingPanelFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-panel-fade { animation: landingPanelFadeIn 0.3s ease; }
      `}</style>
    </div>
  );
}
