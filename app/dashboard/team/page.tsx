import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountOwnerEmail, getPendingOwnerEmail, listTeamMembers } from "@/lib/accounts";
import { listActivityLog } from "@/lib/activity-log";
import { TeamManager } from "../TeamManager";
import { Card, CardTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardTeamPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const [ownerEmail, members, pendingOwnerEmail, activityLog] = await Promise.all([
    getAccountOwnerEmail(session.accountId),
    listTeamMembers(session.accountId),
    getPendingOwnerEmail(session.accountId),
    listActivityLog(session.accountId),
  ]);

  const isOwner = ownerEmail === session.email;

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Ekip</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Davet edilen ekip üyeleri panele giriş yapıp lead/kaynak yönetebilir, form kopyası ve analiz raporu
        kendilerine de gider. Gmail bağlantısı ve hesap ayarları gibi hassas işlemler sadece hesap sahibinde kalır.
      </p>
      <TeamManager isOwner={isOwner} ownerEmail={ownerEmail} members={members} pendingOwnerEmail={pendingOwnerEmail} />

      <div className="mt-10">
        <CardTitle className="px-1">Aktivite Geçmişi</CardTitle>
        <p className="mt-1 px-1 text-xs text-muted-foreground">
          Ekip üyelerinin panelde yaptığı silme/davet/sahiplik gibi işlemlerin son {activityLog.length} kaydı.
        </p>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Zaman</th>
                <th className="px-4 py-2 font-medium">Kim</th>
                <th className="px-4 py-2 font-medium">İşlem</th>
                <th className="px-4 py-2 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activityLog.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                  <td className="px-4 py-2 text-foreground">{entry.actorEmail}</td>
                  <td className="px-4 py-2 text-foreground">{entry.action}</td>
                  <td className="max-w-[280px] truncate px-4 py-2 text-muted-foreground" title={entry.detail ?? undefined}>
                    {entry.detail ?? "—"}
                  </td>
                </tr>
              ))}
              {activityLog.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Henüz kayıtlı aktivite yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}
