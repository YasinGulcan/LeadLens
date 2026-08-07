import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, Globe, Clock, AlertCircle, Search } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { ScoreBreakdown, type ScoreBreakdownData } from "../../ScoreBreakdown";
import { DraftReply } from "../../DraftReply";
import { StatusSelect } from "../../StatusSelect";
import { RANK_TIER_LABEL, rankTier } from "@/lib/rank-tier";
import { isSalesStatus } from "@/lib/lead-status";
import { Card } from "@/components/ui";
import { QuickActions } from "./QuickActions";
import { NotesPanel, type LeadNote } from "./NotesPanel";
import { DeepAnalysis, type DeepAnalysisData } from "./DeepAnalysis";
import { ActivityHistory, type HistoryEntry } from "./ActivityHistory";

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

  const [{ data: lead }, { data: history }, { data: notesData }, isOwner] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, account_id, name, phone, email, website_url, message, status, sales_status, priority, recommended_product, match_score, score_breakdown, reasoning, sales_note, site_finding, sector, clarifying_question, error_message, search_keyword, search_rank_position, ai_visibility_mentioned, deep_analysis, created_at"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("lead_status_history")
      .select("id, detail, actor_email, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_notes")
      .select("id, author_email, content, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    isAccountOwner(session.accountId, session.email),
  ]);

  if (!lead || lead.account_id !== session.accountId) notFound();

  const breakdown = lead.score_breakdown as ScoreBreakdownData | null;
  const deepAnalysis = lead.deep_analysis as DeepAnalysisData | null;
  const salesStatus = isSalesStatus(lead.sales_status) ? lead.sales_status : "yeni";
  const hasAnalysisNotes = lead.sector || lead.site_finding || lead.sales_note || lead.recommended_product || lead.search_keyword;
  const notes: LeadNote[] = (notesData ?? []).map((n) => ({
    id: n.id,
    authorEmail: n.author_email,
    content: n.content,
    createdAt: n.created_at,
  }));
  const historyEntries: HistoryEntry[] = (history ?? []).map((h) => ({
    id: h.id,
    detail: h.detail,
    actorEmail: h.actor_email,
    createdAt: h.created_at,
  }));

  return (
    <div className="max-w-6xl">
      <Link href="/dashboard/leads" className="mb-4 flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        <ArrowLeft size={12} /> Leadler
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
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
              {/* Derinlemesine analiz varsa "Fırsat Analizi" bunun yerini alıyor (aynı bilgiyi genişletiyor) — tekrar göstermiyoruz. */}
              {lead.sales_note && !deepAnalysis && <Field label="Arama Öncesi Not" value={lead.sales_note} />}
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

        {/* Derinlemesine analiz */}
        <div className="px-6 py-5">
          <DeepAnalysis leadId={lead.id} initialData={deepAnalysis} />
        </div>

        {/* Hazır yanıt taslağı */}
        <div className="px-6 py-5">
          <DraftReply leadId={lead.id} leadEmail={lead.email} />
        </div>
      </Card>

      <div className="space-y-6 lg:sticky lg:top-8">
        <QuickActions phone={lead.phone} email={lead.email} websiteUrl={lead.website_url} />
        <NotesPanel leadId={lead.id} notes={notes} currentEmail={session.email} isOwner={isOwner} />
        <ActivityHistory history={historyEntries} />
      </div>
      </div>
    </div>
  );
}
