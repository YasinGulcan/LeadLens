import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, Globe, Clock, AlertCircle, Search } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { ScoreBreakdown, type ScoreBreakdownData } from "../../ScoreBreakdown";
import { DraftReply } from "../../DraftReply";
import { StatusSelect } from "../../StatusSelect";
import { RANK_TIER_LABEL, rankTier } from "@/lib/rank-tier";
import { isSalesStatus } from "@/lib/lead-status";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Bölüm başlığı — kart genelindeki tutarlı, tek gri tonlu tipografi hiyerarşisi. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

/** "Etiket: değer" satırı — vurgu bold yerine sadece daha açık (foreground) renkle. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </p>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const { id } = await params;

  const [{ data: lead }, { data: history }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, account_id, name, phone, email, website_url, message, status, sales_status, priority, recommended_product, match_score, score_breakdown, reasoning, sales_note, site_finding, sector, clarifying_question, error_message, search_keyword, search_rank_position, ai_visibility_mentioned, created_at"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("lead_status_history")
      .select("id, detail, actor_email, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!lead || lead.account_id !== session.accountId) notFound();

  const breakdown = lead.score_breakdown as ScoreBreakdownData | null;
  const salesStatus = isSalesStatus(lead.sales_status) ? lead.sales_status : "yeni";
  const hasAnalysisNotes = lead.sector || lead.site_finding || lead.sales_note || lead.recommended_product || lead.search_keyword;

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/leads" className="mb-4 flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        <ArrowLeft size={12} /> Leadler
      </Link>

      <Card className="divide-y divide-border/70 overflow-hidden">
        {/* Müşteri bilgisi + durum */}
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-foreground">{lead.name ?? "İsimsiz"}</h2>
            <StatusSelect leadId={lead.id} value={salesStatus} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {lead.phone && (
              <span className="flex items-center gap-1">
                <Phone size={12} /> {lead.phone}
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-1">
                <Mail size={12} /> {lead.email}
              </span>
            )}
            {lead.website_url && (
              <a href={lead.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                <Globe size={12} /> {lead.website_url}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Clock size={12} /> {new Date(lead.created_at).toLocaleString("tr-TR")}
            </span>
          </div>
          {lead.error_message && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-red-400/80">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              Son hata: {lead.error_message}
            </p>
          )}
        </div>

        {/* Müşteri mesajı */}
        {lead.message && (
          <div className="px-6 py-5">
            <SectionLabel>Müşteri Mesajı</SectionLabel>
            <p className="text-sm text-foreground">{lead.message}</p>
          </div>
        )}

        {/* Skor */}
        {breakdown ? (
          <div className="px-6 py-5">
            <ScoreBreakdown breakdown={breakdown} overallScore={lead.match_score} />
          </div>
        ) : (
          lead.status !== "error" && (
            <div className="px-6 py-5 text-sm text-muted-foreground">
              {lead.status === "analyzed" || lead.status === "sent_to_sales"
                ? "Bu lead, skor kırılımı özelliği eklenmeden önce analiz edilmiş — geriye dönük kırılım verisi yok."
                : "Bu lead henüz analiz edilmedi."}
            </div>
          )
        )}

        {/* Analiz notları (+ netleştirici soru + arama görünürlüğü) */}
        {hasAnalysisNotes && (
          <div className="px-6 py-5">
            <SectionLabel>Analiz Notları</SectionLabel>
            <div className="space-y-1.5">
              {lead.sector && <Field label="Sektör" value={lead.sector} />}
              {lead.recommended_product && <Field label="Önerilen Ürün" value={lead.recommended_product} />}
              {lead.site_finding && <Field label="Site Bulgusu" value={lead.site_finding} />}
              {lead.sales_note && <Field label="Arama Öncesi Not" value={lead.sales_note} />}
            </div>

            {lead.clarifying_question && (
              <div className="mt-4">
                <span className="text-sm text-muted-foreground">Netleştirici Soru: </span>
                <span className="text-sm text-foreground">{lead.clarifying_question}</span>
              </div>
            )}

            {lead.search_keyword && (
              <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                <Search size={13} className="mt-0.5 shrink-0" />
                <div>
                  <p>
                    &quot;{lead.search_keyword}&quot; için — Web araması görünürlüğü:{" "}
                    <span className="text-foreground">{RANK_TIER_LABEL[rankTier(lead.search_rank_position)]}</span>; AI görünürlüğü:{" "}
                    <span className="text-foreground">
                      {lead.ai_visibility_mentioned == null ? "kontrol edilemedi" : lead.ai_visibility_mentioned ? "marka geçti" : "marka geçmedi"}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hazır yanıt taslağı */}
        <div className="px-6 py-5">
          <DraftReply leadId={lead.id} leadEmail={lead.email} />
        </div>

        {/* İşlem geçmişi */}
        {history && history.length > 0 && (
          <div className="px-6 py-5">
            <SectionLabel>İşlem Geçmişi</SectionLabel>
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-3 text-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold text-muted-foreground">
                    {h.actor_email ? h.actor_email[0]!.toUpperCase() : "S"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-foreground">
                      <span className="text-muted-foreground">{h.actor_email ?? "Sistem"} — </span>
                      {h.detail}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{new Date(h.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}
