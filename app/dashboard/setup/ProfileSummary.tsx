import { Building2, Globe, Users } from "lucide-react";

const TEAM_SIZE_LABEL: Record<string, string> = {
  solo: "Sadece ben",
  "2-5": "2-5 kişi",
  "6-20": "6-20 kişi",
  "20+": "20+ kişi",
};

/**
 * Salt okunur — bu adımın verileri `/onboarding`'de (tek seferlik, hesap
 * kurulurken) toplanıyor, panele erişebilen herkeste zaten tamamlanmış
 * durumda (bkz. lib/setup-checklist.ts). Ayrı bir düzenleme formu yok.
 */
export function ProfileSummary({
  businessName,
  businessSector,
  websiteUrl,
  teamSize,
}: {
  businessName: string;
  businessSector: string | null;
  websiteUrl: string | null;
  teamSize: string | null;
}) {
  const rows = [
    { icon: Building2, label: "İşletme", value: `${businessName}${businessSector ? ` — ${businessSector}` : ""}` },
    { icon: Globe, label: "Web Sitesi", value: websiteUrl ?? "—" },
    { icon: Users, label: "Ekip Büyüklüğü", value: teamSize ? (TEAM_SIZE_LABEL[teamSize] ?? teamSize) : "—" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Hesabınızı kurarken topladığımız bilgiler:</p>
      <div className="space-y-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center gap-3 text-sm">
              <Icon size={15} className="shrink-0 text-muted-foreground" />
              <span className="w-32 shrink-0 text-muted-foreground">{row.label}</span>
              <span className="text-foreground">{row.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
