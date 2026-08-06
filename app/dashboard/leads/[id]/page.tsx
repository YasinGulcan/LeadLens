import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, Globe, Clock } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "../../StatusBadge";
import { ScoreBreakdown, type ScoreBreakdownData } from "../../ScoreBreakdown";
import { DraftReply } from "../../DraftReply";
import { RANK_TIER_LABEL, rankTier } from "@/lib/rank-tier";
import { Card, CardTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const { id } = await params;

  const [{ data: lead }, { data: history }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, account_id, name, phone, email, website_url, message, status, priority, recommended_product, match_score, score_breakdown, reasoning, sales_note, site_finding, sector, clarifying_question, error_message, search_keyword, search_rank_position, ai_visibility_mentioned, created_at"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("lead_status_history")
      .select("id, status, detail, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!lead || lead.account_id !== session.accountId) notFound();

  const breakdown = lead.score_breakdown as ScoreBreakdownData | null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/leads" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          <ArrowLeft size={12} /> Leadler
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold text-foreground">{lead.name ?? "İsimsiz"}</h2>
          <StatusBadge status={lead.status} />
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
            <a href={lead.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
              <Globe size={12} /> {lead.website_url}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} /> {new Date(lead.created_at).toLocaleString("tr-TR")}
          </span>
        </div>
        {lead.message && (
          <Card className="mt-3 p-3 text-sm">
            <strong className="text-xs text-muted-foreground">Müşteri Mesajı</strong>
            <p className="mt-1 text-foreground">{lead.message}</p>
          </Card>
        )}
      </div>

      {lead.error_message && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
          <strong>Son hata:</strong> {lead.error_message}
        </div>
      )}

      {breakdown ? (
        <ScoreBreakdown breakdown={breakdown} overallScore={lead.match_score} />
      ) : (
        lead.status !== "error" && (
          <Card className="p-5 text-sm text-muted-foreground">
            {lead.status === "analyzed" || lead.status === "sent_to_sales"
              ? "Bu lead, skor kırılımı özelliği eklenmeden önce analiz edilmiş — geriye dönük kırılım verisi yok."
              : "Bu lead henüz analiz edilmedi."}
          </Card>
        )
      )}

      {(lead.sector || lead.site_finding || lead.sales_note || lead.recommended_product) && (
        <Card className="p-6">
          <CardTitle>Analiz Notları</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-foreground">
            {lead.sector && (
              <p>
                <strong className="text-muted-foreground">Sektör:</strong> {lead.sector}
              </p>
            )}
            {lead.recommended_product && (
              <p>
                <strong className="text-muted-foreground">Önerilen Ürün:</strong> {lead.recommended_product}
              </p>
            )}
            {lead.site_finding && (
              <p>
                <strong className="text-muted-foreground">Site Bulgusu:</strong> {lead.site_finding}
              </p>
            )}
            {lead.sales_note && (
              <p>
                <strong className="text-muted-foreground">Arama Öncesi Not:</strong> {lead.sales_note}
              </p>
            )}
          </div>
          {lead.clarifying_question && (
            <div className="mt-3 rounded-md bg-amber-500/10 p-2 text-xs">
              <strong>Netleştirici Soru:</strong> {lead.clarifying_question}
            </div>
          )}
          {lead.search_keyword && (
            <div className="mt-3 rounded-md border border-border p-2 text-xs">
              <strong>🔎 Arama Görünürlüğü</strong>{" "}
              <span className="text-muted-foreground">(&quot;{lead.search_keyword}&quot; için tek seferlik örnekleme)</span>
              <p className="mt-1">Web araması görünürlüğü: {RANK_TIER_LABEL[rankTier(lead.search_rank_position)]}</p>
              <p>
                AI görünürlüğü (Claude, gerçek web araması):{" "}
                {lead.ai_visibility_mentioned == null ? "kontrol edilemedi" : lead.ai_visibility_mentioned ? "marka geçti ✓" : "marka geçmedi"}
              </p>
            </div>
          )}
        </Card>
      )}

      <DraftReply leadId={lead.id} leadEmail={lead.email} />

      {history && history.length > 0 && (
        <Card className="p-6">
          <CardTitle>Geçmiş</CardTitle>
          <ol className="mt-3 space-y-1.5 text-xs">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="w-40 shrink-0 text-muted-foreground">{new Date(h.created_at).toLocaleString("tr-TR")}</span>
                <StatusBadge status={h.status} />
                <span className="text-muted-foreground">{h.detail}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
