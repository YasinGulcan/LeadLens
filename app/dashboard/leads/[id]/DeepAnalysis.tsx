"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, ListChecks, Tag, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

export interface DeepAnalysisData {
  site_findings: string[];
  opportunity_headline: string;
  opportunity_body: string;
  confidence_note: string;
  matched_services: { name: string; reason: string }[];
  pricing_hint: string;
  first_call_questions: string[];
  watch_out: string[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

function MiniCard({ icon: Icon, title, children }: { icon: typeof Tag; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon size={12} />
        {title}
      </div>
      <div className="mt-1.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

export function DeepAnalysis({ leadId, initialData }: { leadId: string; initialData: DeepAnalysisData | null }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/deep-analysis`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Bilinmeyen hata");
      setData(result.deepAnalysis);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  if (!data) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <SectionLabel>Derinlemesine Analiz</SectionLabel>
          <Button variant="secondary" size="sm" disabled={pending} onClick={generate}>
            {pending ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Oluşturuluyor...
              </>
            ) : (
              "Derinlemesine Analiz Oluştur"
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Site bulguları, fırsat analizi, eşleşen hizmetler ve görüşme hazırlığı içeren zenginleştirilmiş bir rapor üretir.
        </p>
        {error && <p className="mt-2 text-xs text-red-400/80">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>Derinlemesine Analiz</SectionLabel>
        <Button variant="secondary" size="sm" disabled={pending} onClick={generate}>
          {pending ? "Yenileniyor..." : "Yeniden Oluştur"}
        </Button>
      </div>

      {/* Web sitesinden çıkarılanlar */}
      {data.site_findings.length > 0 && (
        <ul className="space-y-1.5">
          {data.site_findings.map((finding, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              {finding}
            </li>
          ))}
        </ul>
      )}

      {/* Fırsat analizi */}
      <div className="rounded-md bg-accent/10 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent uppercase">
          <Sparkles size={12} />
          Fırsat Analizi
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">{data.opportunity_headline}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{data.opportunity_body}</p>
      </div>

      {/* Ölçüm güvenilirliği */}
      <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
        <div className="flex items-start gap-2 text-xs text-foreground">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-warning">Ölçüm Güvenilirliği</p>
            <p className="mt-1 text-muted-foreground">{data.confidence_note}</p>
          </div>
        </div>
      </div>

      {/* Eşleşen hizmetler */}
      {data.matched_services.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <ListChecks size={12} />
            Eşleşen Hizmetler
          </div>
          <ol className="mt-2 space-y-2">
            {data.matched_services.map((service, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">{i + 1}.</span>
                <p>
                  <span className="font-semibold text-foreground">{service.name}</span>{" "}
                  <span className="text-muted-foreground">— {service.reason}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Görüşme hazırlığı */}
      <div>
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Görüşme Hazırlığı</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <MiniCard icon={Tag} title="Fiyatlandırma">
            {data.pricing_hint}
          </MiniCard>
          <MiniCard icon={HelpCircle} title="İlk Görüşmede Sorulacaklar">
            <ol className="space-y-1">
              {data.first_call_questions.map((q, i) => (
                <li key={i}>
                  {i + 1}. {q}
                </li>
              ))}
            </ol>
          </MiniCard>
          <MiniCard icon={AlertTriangle} title="Dikkat">
            <ul className="space-y-1 text-warning">
              {data.watch_out.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </MiniCard>
        </div>
      </div>

      {error && <p className="text-xs text-red-400/80">{error}</p>}
    </div>
  );
}
