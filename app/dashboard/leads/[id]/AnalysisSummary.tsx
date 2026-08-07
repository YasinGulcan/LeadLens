import { Search } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { RANK_TIER_LABEL, rankTier } from "@/lib/rank-tier";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </p>
  );
}

/** Lead detay sağ sütunundaki "Özet" — sektör/önerilen ürün/site bulgusu gibi kısa etiket:değer bilgileri, dar sütuna doğal oturduğu için buraya taşındı. */
export function AnalysisSummary({
  sector,
  recommendedProduct,
  siteFinding,
  salesNote,
  showSalesNote,
  clarifyingQuestion,
  searchKeyword,
  searchRankPosition,
  aiVisibilityMentioned,
}: {
  sector: string | null;
  recommendedProduct: string | null;
  siteFinding: string | null;
  salesNote: string | null;
  /** Derinlemesine Analiz üretilmişse "Fırsat Analizi" bunun yerini alıyor — o zaman burada tekrar gösterilmiyor. */
  showSalesNote: boolean;
  clarifyingQuestion: string | null;
  searchKeyword: string | null;
  searchRankPosition: number | null;
  aiVisibilityMentioned: boolean | null;
}) {
  const hasAnything = sector || recommendedProduct || siteFinding || (salesNote && showSalesNote) || clarifyingQuestion || searchKeyword;
  if (!hasAnything) return null;

  return (
    <Card className="p-4">
      <CardTitle>Özet</CardTitle>
      <div className="mt-3 space-y-1.5">
        {sector && <Field label="Sektör" value={sector} />}
        {recommendedProduct && <Field label="Önerilen Ürün" value={recommendedProduct} />}
        {siteFinding && <Field label="Site Bulgusu" value={siteFinding} />}
        {salesNote && showSalesNote && <Field label="Arama Öncesi Not" value={salesNote} />}
      </div>

      {clarifyingQuestion && (
        <div className="mt-3 text-sm">
          <span className="text-muted-foreground">Netleştirici Soru: </span>
          <span className="text-foreground">{clarifyingQuestion}</span>
        </div>
      )}

      {searchKeyword && (
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Search size={13} className="mt-0.5 shrink-0" />
          <p>
            &quot;{searchKeyword}&quot; için — Web: <span className="text-foreground">{RANK_TIER_LABEL[rankTier(searchRankPosition)]}</span>; AI:{" "}
            <span className="text-foreground">
              {aiVisibilityMentioned == null ? "kontrol edilemedi" : aiVisibilityMentioned ? "marka geçti" : "marka geçmedi"}
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
