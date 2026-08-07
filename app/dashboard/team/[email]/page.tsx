import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Clock, Inbox, ListChecks, StickyNote, RefreshCcw } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountOwnerEmail, isActiveAccountPerson } from "@/lib/accounts";
import { getMemberProfileData } from "@/lib/member-profile";
import { supabase } from "@/lib/supabase";
import { Card, CardTitle, StatCard, Badge, ScoreBadge } from "@/components/ui";
import { SALES_STATUS_LABEL, SALES_STATUS_BADGE_CLASS } from "@/lib/lead-status";

export const dynamic = "force-dynamic";

/**
 * Herhangi bir ekip üyesinin profili — herkes birbirinin profilini görebilir
 * (yazma işlemleri değil, sadece görüntüleme), o yüzden ekstra bir sahiplik
 * kontrolü yok; tek kontrol, `email`'in gerçekten bu hesabın sahibi/aktif bir
 * üyesi olması (rastgele bir e-posta ile profil sayfası uydurulamasın diye).
 */
export default async function MemberProfilePage({ params }: { params: Promise<{ email: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);

  if (!(await isActiveAccountPerson(session.accountId, email))) notFound();

  const ownerEmail = await getAccountOwnerEmail(session.accountId);
  const isOwner = ownerEmail === email;

  const [joinedAtResult, profile] = await Promise.all([
    isOwner
      ? supabase.from("gmail_connections").select("connected_at").eq("account_id", session.accountId).single()
      : supabase.from("account_members").select("accepted_at").eq("account_id", session.accountId).eq("email", email).single(),
    getMemberProfileData(session.accountId, email),
  ]);
  const joinedAt = isOwner
    ? ((joinedAtResult.data as { connected_at: string } | null)?.connected_at ?? null)
    : ((joinedAtResult.data as { accepted_at: string | null } | null)?.accepted_at ?? null);

  const { stats, assignedLeads, activity } = profile;

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/team" className="mb-4 flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        <ArrowLeft size={12} /> Ekip
      </Link>

      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl font-semibold text-accent">
          {email[0]!.toUpperCase()}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">{email}</h2>
            <Badge variant={isOwner ? "accent" : "neutral"}>{isOwner ? "Sahip" : "Üye"}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {joinedAt ? `Hesaba katıldı: ${new Date(joinedAt).toLocaleDateString("tr-TR")}` : "Katılma tarihi bilinmiyor"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ListChecks} label="Toplam Atanan" value={stats.totalAssigned} hint="lead" />
        <StatCard icon={Trophy} label="Kazanılan" value={stats.wonCount} hint="lead" />
        <StatCard icon={Clock} label="Ort. Yanıt Süresi" value={stats.avgResponseLabel ?? "—"} />
        <StatCard icon={Inbox} label="Açık / Devam Eden" value={stats.openCount} hint="lead" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <CardTitle className="px-1">Atanan Leadler</CardTitle>
          <Card className="mt-3 divide-y divide-border overflow-hidden">
            {assignedLeads.map((l) => (
              <Link
                key={l.id}
                href={`/dashboard/leads/${l.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <ScoreBadge score={l.matchScore} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{l.name ?? "İsimsiz"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("tr-TR")}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${SALES_STATUS_BADGE_CLASS[l.salesStatus]}`}
                >
                  {SALES_STATUS_LABEL[l.salesStatus]}
                </span>
              </Link>
            ))}
            {assignedLeads.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Henüz atanan lead yok.</div>}
          </Card>
        </div>

        <div>
          <CardTitle className="px-1">Son Aktiviteler</CardTitle>
          <Card className="mt-3 divide-y divide-border overflow-hidden">
            {activity.map((a) => (
              <div key={`${a.type}-${a.id}`} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-muted-foreground">
                  {a.type === "note" ? <StickyNote size={12} /> : <RefreshCcw size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/leads/${a.leadId}`} className="text-sm font-medium text-foreground hover:text-accent hover:underline">
                    {a.leadName ?? "İsimsiz lead"}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.detail}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">{new Date(a.createdAt).toLocaleString("tr-TR")}</p>
                </div>
              </div>
            ))}
            {activity.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Henüz aktivite yok.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
