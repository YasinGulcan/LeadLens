import { supabase } from "./supabase";
import type { BadgeVariant } from "@/components/ui";

export type SetupStepKey = "mail" | "filters" | "knowledge-base" | "profile";

export interface SetupStep {
  key: SetupStepKey;
  title: string;
  href: string;
  done: boolean;
  required: boolean;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  /** Kurulum Paneli sayfasında adımın altında gösterilen, 1 cümlelik "neden gerekli" açıklaması. */
  why: string;
}

export interface SetupStatus {
  steps: SetupStep[];
  requiredDone: boolean;
  completedCount: number;
  totalCount: number;
  dismissed: boolean;
}

/**
 * Kurulumun 4 adımının gerçek durumunu tek yerden hesaplar — sidebar rozeti,
 * Ana Ekran'daki ince banner ve `/dashboard/setup` sayfası hep bu tek
 * fonksiyondan besleniyor, üçü de aynı gerçek veriye dayanıyor.
 *
 * "Profil ve tercihler" adımı, dashboard/layout.tsx zaten onboarded_at
 * boşsa /onboarding'e yönlendirdiği için buraya ulaşan herkeste hep ✓
 * görünür — bilinçli bir mimari sonuç, bug değil.
 */
export async function getSetupStatus(accountId: string): Promise<SetupStatus> {
  const [{ data: connection }, { data: account }, { count: chunkCount }] = await Promise.all([
    supabase.from("gmail_connections").select("disconnected_at").eq("account_id", accountId).maybeSingle(),
    supabase
      .from("accounts")
      .select("lead_email_subjects, primary_lead_source, onboarded_at, setup_checklist_dismissed")
      .eq("id", accountId)
      .single(),
    supabase.from("product_chunks").select("id", { count: "exact", head: true }).eq("account_id", accountId),
  ]);

  const mailConnected = !!connection && !connection.disconnected_at;
  const filtersDefined = (account?.lead_email_subjects?.length ?? 0) > 0;
  const knowledgeBaseReady = (chunkCount ?? 0) > 0;
  const profileDone = !!account?.onboarded_at;
  const filtersOptional = account?.primary_lead_source === "forwarding";

  const steps: SetupStep[] = [
    {
      key: "mail",
      title: "Mail kaynağını bağla",
      href: "/dashboard/gmail",
      done: mailConnected,
      required: true,
      badgeLabel: "ZORUNLU",
      badgeVariant: "danger",
      why: "Mail kaynağı olmadan yeni leadler sisteme hiç düşmez.",
    },
    {
      key: "filters",
      title: "Filtreleri tanımla",
      href: "/dashboard/settings",
      done: filtersDefined,
      required: false,
      badgeLabel: filtersOptional ? "İSTEĞE BAĞLI" : "GEREKLİ",
      badgeVariant: filtersOptional ? "neutral" : "warning",
      why: filtersOptional
        ? "Yönlendirme adresi kullandığınız için başlık filtresi şart değil."
        : "Gmail'de hangi başlıkların lead sayılacağını belirlemezseniz hiçbir mail yakalanmaz.",
    },
    {
      key: "knowledge-base",
      title: "Bilgi tabanı ekle",
      href: "/dashboard/sources",
      done: knowledgeBaseReady,
      required: true,
      badgeLabel: "ZORUNLU",
      badgeVariant: "danger",
      why: "Ürün/hizmet bilgisi olmadan yapay zeka anlamlı bir öneri üretemez.",
    },
    {
      key: "profile",
      title: "Profil ve tercihler",
      href: "/dashboard/settings",
      done: profileDone,
      required: false,
      badgeLabel: "İSTEĞE BAĞLI",
      badgeVariant: "neutral",
      why: "İşletme bilgileriniz analizlerin bağlamını netleştirir, zorunlu değildir.",
    },
  ];

  return {
    steps,
    requiredDone: mailConnected && knowledgeBaseReady,
    completedCount: steps.filter((s) => s.done).length,
    totalCount: steps.length,
    dismissed: !!account?.setup_checklist_dismissed,
  };
}
