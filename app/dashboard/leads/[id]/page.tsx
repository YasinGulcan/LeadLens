import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "../../badges";
import { ScoreBreakdown, type ScoreBreakdownData } from "../../ScoreBreakdown";
import { DraftReply } from "../../DraftReply";
import { RANK_TIER_LABEL, rankTier } from "@/lib/rank-tier";

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
        <Link href="/dashboard/leads" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
          ← Leadler
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">{lead.name ?? "İsimsiz"}</h2>
          <StatusBadge status={lead.status} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          {lead.phone && <span>📞 {lead.phone}</span>}
          {lead.email && <span>✉️ {lead.email}</span>}
          {lead.website_url && (
            <a href={lead.website_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
              🔗 {lead.website_url}
            </a>
          )}
          <span>{new Date(lead.created_at).toLocaleString("tr-TR")}</span>
        </div>
        {lead.message && (
          <div className="mt-3 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
            <strong className="text-xs text-neutral-500">Müşteri Mesajı</strong>
            <p className="mt-1">{lead.message}</p>
          </div>
        )}
      </div>

      {lead.error_message && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          <strong>Son hata:</strong> {lead.error_message}
        </div>
      )}

      {breakdown ? (
        <ScoreBreakdown breakdown={breakdown} overallScore={lead.match_score} />
      ) : (
        lead.status !== "error" && (
          <div className="rounded-lg border border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
            {lead.status === "analyzed" || lead.status === "sent_to_sales"
              ? "Bu lead, skor kırılımı özelliği eklenmeden önce analiz edilmiş — geriye dönük kırılım verisi yok."
              : "Bu lead henüz analiz edilmedi."}
          </div>
        )
      )}

      {(lead.sector || lead.site_finding || lead.sales_note || lead.recommended_product) && (
        <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">Analiz Notları</h3>
          <div className="mt-3 space-y-2 text-sm">
            {lead.sector && (
              <p>
                <strong className="text-neutral-500">Sektör:</strong> {lead.sector}
              </p>
            )}
            {lead.recommended_product && (
              <p>
                <strong className="text-neutral-500">Önerilen Ürün:</strong> {lead.recommended_product}
              </p>
            )}
            {lead.site_finding && (
              <p>
                <strong className="text-neutral-500">Site Bulgusu:</strong> {lead.site_finding}
              </p>
            )}
            {lead.sales_note && (
              <p>
                <strong className="text-neutral-500">Arama Öncesi Not:</strong> {lead.sales_note}
              </p>
            )}
          </div>
          {lead.clarifying_question && (
            <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs dark:bg-amber-950">
              <strong>Netleştirici Soru:</strong> {lead.clarifying_question}
            </div>
          )}
          {lead.search_keyword && (
            <div className="mt-3 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-700">
              <strong>🔎 Arama Görünürlüğü</strong>{" "}
              <span className="text-neutral-400">(&quot;{lead.search_keyword}&quot; için tek seferlik örnekleme)</span>
              <p className="mt-1">Web araması görünürlüğü: {RANK_TIER_LABEL[rankTier(lead.search_rank_position)]}</p>
              <p>
                AI görünürlüğü (Claude, gerçek web araması):{" "}
                {lead.ai_visibility_mentioned == null ? "kontrol edilemedi" : lead.ai_visibility_mentioned ? "marka geçti ✓" : "marka geçmedi"}
              </p>
            </div>
          )}
        </div>
      )}

      <DraftReply leadId={lead.id} leadEmail={lead.email} />

      {history && history.length > 0 && (
        <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">Geçmiş</h3>
          <ol className="mt-3 space-y-1.5 text-xs">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="w-40 shrink-0 text-neutral-400">{new Date(h.created_at).toLocaleString("tr-TR")}</span>
                <StatusBadge status={h.status} />
                <span className="text-neutral-600 dark:text-neutral-400">{h.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
