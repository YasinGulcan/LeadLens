import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { SourcesForm } from "../SourcesForm";
import { FileUploadForm } from "../FileUploadForm";
import { SourcesTable } from "../SourcesTable";

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
      <h2 className="text-lg font-semibold">Ürün Kataloğu</h2>
      <p className="mt-1 text-xs text-neutral-500">
        URL ekleyerek site taratabilir ya da bir dosya (CSV/Excel/PDF) yükleyebilirsiniz — ikisi de hemen işlenip embed edilir.
        {!isOwner && " Kaynak/chunk silme sadece hesap sahibinde."}
      </p>

      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-neutral-500">URL&apos;den Tara</h3>
          <SourcesForm />
        </div>
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Dosya Yükle</h3>
          <FileUploadForm />
        </div>
      </div>

      <div className="mt-6">
        <SourcesTable sources={sources ?? []} chunkCountBySource={Object.fromEntries(chunkCountBySource)} canDelete={isOwner} />
      </div>
    </section>
  );
}
