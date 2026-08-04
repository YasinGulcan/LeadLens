import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountOwnerEmail, getPendingOwnerEmail, listTeamMembers } from "@/lib/accounts";
import { TeamManager } from "../TeamManager";

export const dynamic = "force-dynamic";

export default async function DashboardTeamPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const [ownerEmail, members, pendingOwnerEmail] = await Promise.all([
    getAccountOwnerEmail(session.accountId),
    listTeamMembers(session.accountId),
    getPendingOwnerEmail(session.accountId),
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
    </section>
  );
}
