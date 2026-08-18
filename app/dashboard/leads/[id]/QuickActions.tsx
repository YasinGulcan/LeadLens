import { ExternalLink } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { AssignLead } from "./AssignLead";
import type { AssignableMember } from "@/lib/accounts";

const ACTION_CLASS =
  "flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover";

/** Lead detay sağ sütunundaki "Hızlı Aksiyonlar" — dışa açılan site linki (loglanmıyor) + ekip üyesine atama (loglanıyor). E-posta göndermek için zaten aşağıdaki "Hazır Yanıt Taslağı" var, burada ayrıca mailto: linkine gerek yok. */
export function QuickActions({
  leadId,
  websiteUrl,
  assignedTo,
  assignableMembers,
  currentEmail,
}: {
  leadId: string;
  websiteUrl: string | null;
  assignedTo: string | null;
  assignableMembers: AssignableMember[];
  currentEmail: string;
}) {
  return (
    <Card className="p-4">
      <CardTitle>Hızlı Aksiyonlar</CardTitle>
      <div className="mt-3 space-y-2">
        <AssignLead leadId={leadId} members={assignableMembers} assignedTo={assignedTo} currentEmail={currentEmail} />

        {websiteUrl && (
          <a href={websiteUrl} target="_blank" rel="noreferrer" className={ACTION_CLASS}>
            <ExternalLink size={15} className="text-accent" />
            Siteyi Ziyaret Et
          </a>
        )}
      </div>
    </Card>
  );
}
