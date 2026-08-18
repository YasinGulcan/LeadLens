import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { KnowledgeBaseContent } from "./KnowledgeBaseContent";

export const dynamic = "force-dynamic";

export default async function DashboardSourcesPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const [{ data: sources }, { data: chunkSourceIds }, isOwner] = await Promise.all([
    supabase
      .from("product_sources")
      .select("id, url, label, active, source_type, file_name, last_scraped_at, last_scrape_status, last_scrape_error")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase.from("product_chunks").select("source_id").eq("account_id", accountId),
    isAccountOwner(accountId, session.email),
  ]);

  const chunkCountBySource = new Map<string, number>();
  for (const row of chunkSourceIds ?? []) {
    if (!row.source_id) continue;
    chunkCountBySource.set(row.source_id, (chunkCountBySource.get(row.source_id) ?? 0) + 1);
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Bilgi Tabanı</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        URL ekleyerek site taratabilir ya da bir dosya (CSV/Excel/PDF) yükleyebilirsiniz — ikisi de hemen işlenip embed edilir.
        {!isOwner && " Kaynak/chunk silme sadece hesap sahibinde."}
      </p>

      <div className="mt-4 flex items-start gap-2.5 rounded-md border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
        <Info size={15} className="mt-0.5 shrink-0 text-accent" />
        <div className="space-y-1.5">
          <p>
            <span className="font-medium text-foreground">Burası, AI&apos;nin her lead&apos;i analiz ederken hangi ürünü/hizmeti
            önereceğini ve yanıt taslağını neye göre yazacağını belirliyor.</span> Bilgi tabanı boş ya da zayıfsa öneriler
            genel geçer kalır, gerçek ürün/hizmet detaylarına dayanmaz.
          </p>
          <p>
            Yalnızca <span className="font-medium text-foreground">ürün/hizmet açıklayan gerçek içerik sayfalarını</span> ekleyin —
            blog yazıları, dil varyantları (ör. <code className="rounded bg-background px-1 py-0.5">/en/</code>) ya da eklentinin
            ürettiği teknik sayfalar eklenirse hem gereksiz Firecrawl/embedding maliyeti oluşur hem de AI doğru ürünü bulmakta
            zorlanabilir (alakasız içerik arttıkça eşleştirme gürültülenir). URL&apos;den Tara adımı bu yüzden sayfaları
            gruplayıp muhtemel dil varyantlarını varsayılan olarak seçili getirmiyor.
          </p>
          <p>
            Site içeriğiniz değişirse (fiyat, ürün adı vb.) burası <span className="font-medium text-foreground">otomatik
            güncellenmez</span> — aşağıdaki tablodan ilgili kaynağı &quot;Yeniden Tara&quot;yla elle güncelleyin, aksi halde AI
            eski/yanlış bilgiye dayanarak öneride bulunmaya devam eder.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <KnowledgeBaseContent
          sources={sources ?? []}
          chunkCountBySource={Object.fromEntries(chunkCountBySource)}
          canDelete={isOwner}
        />
      </div>
    </section>
  );
}
