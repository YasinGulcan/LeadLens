import Link from "next/link";
import { Check, ChevronRight, Link2, Filter, Database, Settings, PartyPopper } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, Badge, type BadgeVariant } from "@/components/ui";
import { DismissChecklistButton } from "./DismissChecklistButton";

interface Step {
  key: string;
  title: string;
  href: string;
  icon: typeof Link2;
  done: boolean;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
}

/**
 * Ana Ekran'ın en üstündeki kurulum rehberi — her sayfa yüklemesinde gerçek
 * backend durumuna göre yeniden hesaplanır, statik/sahte ilerleme yok.
 * "Profil ve tercihler" adımı, dashboard/layout.tsx zaten onboarded_at boşsa
 * /onboarding'e yönlendirdiği için buraya ulaşan herkeste hep ✓ görünür —
 * bilinçli bir mimari sonuç, bug değil.
 */
export async function SetupChecklist({ accountId }: { accountId: string }) {
  const [{ data: connection }, { data: account }, { count: chunkCount }] = await Promise.all([
    supabase.from("gmail_connections").select("disconnected_at").eq("account_id", accountId).maybeSingle(),
    supabase.from("accounts").select("lead_email_subjects, primary_lead_source, onboarded_at, setup_checklist_dismissed").eq("id", accountId).single(),
    supabase.from("product_chunks").select("id", { count: "exact", head: true }).eq("account_id", accountId),
  ]);

  if (account?.setup_checklist_dismissed) return null;

  const mailConnected = !!connection && !connection.disconnected_at;
  const filtersDefined = (account?.lead_email_subjects?.length ?? 0) > 0;
  const knowledgeBaseReady = (chunkCount ?? 0) > 0;
  const profileDone = !!account?.onboarded_at;
  const filtersOptional = account?.primary_lead_source === "forwarding";

  const steps: Step[] = [
    {
      key: "mail",
      title: "Mail kaynağını bağla",
      href: "/dashboard/gmail",
      icon: Link2,
      done: mailConnected,
      badgeLabel: "ZORUNLU",
      badgeVariant: "danger",
    },
    {
      key: "filters",
      title: "Filtreleri tanımla",
      href: "/dashboard/settings",
      icon: Filter,
      done: filtersDefined,
      badgeLabel: filtersOptional ? "İSTEĞE BAĞLI" : "GEREKLİ",
      badgeVariant: filtersOptional ? "neutral" : "warning",
    },
    {
      key: "knowledge-base",
      title: "Bilgi tabanı ekle",
      href: "/dashboard/sources",
      icon: Database,
      done: knowledgeBaseReady,
      badgeLabel: "ZORUNLU",
      badgeVariant: "danger",
    },
    {
      key: "profile",
      title: "Profil ve tercihler",
      href: "/dashboard/settings",
      icon: Settings,
      done: profileDone,
      badgeLabel: "İSTEĞE BAĞLI",
      badgeVariant: "neutral",
    },
  ];

  const requiredDone = mailConnected && knowledgeBaseReady;
  const completedCount = steps.filter((s) => s.done).length;

  if (requiredDone) {
    return (
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5 text-sm text-foreground">
          <PartyPopper size={16} className="text-accent" />
          Kurulum tamamlandı.
        </div>
        <DismissChecklistButton />
      </Card>
    );
  }

  const missing: string[] = [];
  if (!mailConnected) missing.push("mail kaynağı");
  if (!knowledgeBaseReady) missing.push("bilgi tabanı");

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Kurulum {completedCount}/4</h3>
          <p className="mt-1 text-xs text-muted-foreground">Analiz başlaması için {missing.join(" ve ")} gerekiyor.</p>
        </div>
        <DismissChecklistButton />
      </div>

      <ol className="mt-4 divide-y divide-border/70">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 py-3 transition-colors hover:bg-surface-hover ${step.done ? "opacity-60" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    step.done ? "bg-accent text-white" : "bg-surface-hover text-muted-foreground"
                  }`}
                >
                  {step.done ? <Check size={14} /> : i + 1}
                </span>
                <Icon size={15} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-sm text-foreground">{step.title}</span>
                <Badge variant={step.badgeVariant}>{step.badgeLabel}</Badge>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
