import { SourcesForm } from "../SourcesForm";
import { FileUploadForm } from "../FileUploadForm";
import { SourcesTable, type SourceRow } from "../SourcesTable";

/** `/dashboard/sources` sayfası ve Kurulum Paneli'nin "Bilgi Tabanı Ekle" adımı tarafından paylaşılıyor. */
export function KnowledgeBaseContent({
  sources,
  chunkCountBySource,
  canDelete,
}: {
  sources: SourceRow[];
  chunkCountBySource: Record<string, number>;
  canDelete: boolean;
}) {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">URL&apos;den Tara</h3>
          <SourcesForm />
        </div>
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Dosya Yükle</h3>
          <FileUploadForm />
        </div>
      </div>

      <div className="mt-8">
        <SourcesTable sources={sources} chunkCountBySource={chunkCountBySource} canDelete={canDelete} />
      </div>
    </>
  );
}
