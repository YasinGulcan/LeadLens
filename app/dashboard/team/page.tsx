import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountOwnerEmail, getPendingOwnerEmail, listTeamMembers } from "@/lib/accounts";
import { listActivityLog, getActivityLogCount } from "@/lib/activity-log";
import { TeamManager } from "../TeamManager";
import { ActivityLogTable } from "./ActivityLogTable";
import { CardTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardTeamPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const [ownerEmail, members, pendingOwnerEmail, activityLog, activityLogCount] = await Promise.all([
    getAccountOwnerEmail(session.accountId),
    listTeamMembers(session.accountId),
    getPendingOwnerEmail(session.accountId),
    listActivityLog(session.accountId),
    getActivityLogCount(session.accountId),
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
          Ekip üyelerinin panelde yaptığı silme/davet/sahiplik gibi işlemlerin geçmişi (toplam {activityLogCount} kayıt).
        </p>
        <ActivityLogTable initialEntries={activityLog} totalCount={activityLogCount} />
      </div>
    </section>
  );
}
