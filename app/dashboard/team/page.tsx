import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountOwnerEmail, getPendingOwnerEmail, listTeamMembers } from "@/lib/accounts";
import { listActivityLog } from "@/lib/activity-log";
import { TeamManager } from "../TeamManager";

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
      <h2 className="text-lg font-semibold">Ekip</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Davet edilen ekip üyeleri panele giriş yapıp lead/kaynak yönetebilir, form kopyası ve analiz raporu
        kendilerine de gider. Gmail bağlantısı ve hesap ayarları gibi hassas işlemler sadece hesap sahibinde kalır.
      </p>
      <TeamManager isOwner={isOwner} ownerEmail={ownerEmail} members={members} pendingOwnerEmail={pendingOwnerEmail} />

      <div className="mt-10">
        <h3 className="text-sm font-semibold">Aktivite Geçmişi</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Ekip üyelerinin panelde yaptığı silme/davet/sahiplik gibi işlemlerin son {activityLog.length} kaydı.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium">Zaman</th>
                <th className="px-4 py-2 font-medium">Kim</th>
                <th className="px-4 py-2 font-medium">İşlem</th>
                <th className="px-4 py-2 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody>
              {activityLog.map((entry) => (
                <tr key={entry.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                    {new Date(entry.createdAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="px-4 py-2">{entry.actorEmail}</td>
                  <td className="px-4 py-2">{entry.action}</td>
                  <td className="max-w-[280px] truncate px-4 py-2 text-neutral-500" title={entry.detail ?? undefined}>
                    {entry.detail ?? "—"}
                  </td>
                </tr>
              ))}
              {activityLog.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    Henüz kayıtlı aktivite yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
