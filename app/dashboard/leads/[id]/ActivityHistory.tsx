import { Card, CardTitle } from "@/components/ui";

export interface HistoryEntry {
  id: string;
  detail: string | null;
  actorEmail: string | null;
  createdAt: string;
}

/** Lead detay sağ sütunundaki "İşlem Geçmişi" — sistem pipeline geçişleri + insan (satış-durumu) değişiklikleri, aynı avatar/zaman çizelgesi stiliyle Notlar'la eşleşiyor. */
export function ActivityHistory({ history }: { history: HistoryEntry[] }) {
  return (
    <Card className="p-4">
      <CardTitle>İşlem Geçmişi</CardTitle>
      <div className="mt-3">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz işlem yok.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-xs">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold text-muted-foreground">
                  {h.actorEmail ? h.actorEmail[0]!.toUpperCase() : "S"}
                </span>
                <div className="min-w-0">
                  <p className="text-foreground">
                    <span className="text-muted-foreground">{h.actorEmail ?? "Sistem"} — </span>
                    {h.detail}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{new Date(h.createdAt).toLocaleString("tr-TR")}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
