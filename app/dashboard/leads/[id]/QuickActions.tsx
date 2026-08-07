import { Phone, Mail, ExternalLink } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { AssignLead } from "./AssignLead";
import type { AssignableMember } from "@/lib/accounts";

const ACTION_CLASS =
  "flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover";
const DISABLED_CLASS = "flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-muted-foreground opacity-50";

/** Lead detay sağ sütunundaki "Hızlı Aksiyonlar" — dışa açılan tel:/mailto:/site linkleri (loglanmıyor) + ekip üyesine atama (loglanıyor). */
export function QuickActions({
  leadId,
  phone,
  email,
  websiteUrl,
  assignedTo,
  assignableMembers,
  currentEmail,
}: {
  leadId: string;
  phone: string | null;
  email: string | null;
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

        {phone ? (
          <a href={`tel:${phone}`} className={ACTION_CLASS}>
            <Phone size={15} className="text-accent" />
            Ara
          </a>
        ) : (
          <div className={DISABLED_CLASS}>
            <Phone size={15} />
            Ara
          </div>
        )}

        {email ? (
          <a href={`mailto:${email}`} className={ACTION_CLASS}>
            <Mail size={15} className="text-accent" />
            E-posta Gönder
          </a>
        ) : (
          <div>
            <div className={DISABLED_CLASS}>
              <Mail size={15} />
              E-posta Gönder
            </div>
            <p className="mt-1 text-xs text-muted-foreground">e-posta yok</p>
          </div>
        )}

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
