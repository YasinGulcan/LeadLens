import { redirect } from "next/navigation";
import { AlertCircle, FileText, Sparkles, Send } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { getSetupStatus } from "@/lib/setup-checklist";
import { isAccountOwner, getOrCreateInboundToken } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { buildInboundAddress } from "@/lib/inbound-email";
import { CardTitle } from "@/components/ui";
import { SetupAccordion } from "./SetupAccordion";
import { ProfileSummary } from "./ProfileSummary";
import { MailSourceContent } from "../gmail/MailSourceContent";
import { KnowledgeBaseContent } from "../sources/KnowledgeBaseContent";
import { SettingsForm } from "../SettingsForm";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  { icon: FileText, title: "Form dolduruluyor", body: "Müşteriniz web sitenizdeki formu dolduruyor." },
  { icon: Sparkles, title: "Otomatik analiz", body: "Site taranıyor, bilgi tabanınızla eşleştirilip skorlanıyor." },
  { icon: Send, title: "Satışa bildirim", body: "Ekibiniz skor ve önerilen ürünle birlikte lead'i alıyor." },
];

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ connectError?: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;
  const { connectError } = await searchParams;

  const [status, { data: connection }, { data: account }, isOwner, inboundToken, { data: sources }, { data: chunkSourceIds }] =
    await Promise.all([
      getSetupStatus(accountId),
      supabase.from("gmail_connections").select("connected_email, connected_at, disconnected_at").eq("account_id", accountId).maybeSingle(),
      supabase
        .from("accounts")
        .select("business_name, slug, lead_email_subjects, primary_lead_source, inbound_last_received_at, business_sector, website_url, team_size")
        .eq("id", accountId)
        .single(),
      isAccountOwner(accountId, session.email),
      getOrCreateInboundToken(accountId),
      supabase
        .from("product_sources")
        .select("id, url, label, active, source_type, file_name, last_scraped_at, last_scrape_status, last_scrape_error")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true }),
      supabase.from("product_chunks").select("source_id").eq("account_id", accountId),
    ]);

  const inboundAddress = account ? buildInboundAddress(account.slug, inboundToken) : null;

  const chunkCountBySource = new Map<string, number>();
  for (const row of chunkSourceIds ?? []) {
    if (!row.source_id) continue;
    chunkCountBySource.set(row.source_id, (chunkCountBySource.get(row.source_id) ?? 0) + 1);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">Kurulum Paneli</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {status.completedCount}/{status.totalCount} adım tamamlandı.
      </p>

      {connectError && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {connectError}
        </p>
      )}

      <div className="mt-6">
        <SetupAccordion
          steps={status.steps}
          requiredDone={status.requiredDone}
          content={{
            mail: (
              <MailSourceContent
                accountId={accountId}
                isOwner={isOwner}
                connection={connection}
                account={account}
                inboundAddress={inboundAddress}
                returnTo="/dashboard/setup"
              />
            ),
            filters: (
              <SettingsForm
                initialBusinessName={account?.business_name ?? ""}
                initialSlug={account?.slug ?? ""}
                initialLeadEmailSubjects={account?.lead_email_subjects ?? []}
                isOwner={isOwner}
              />
            ),
            "knowledge-base": (
              <KnowledgeBaseContent
                sources={sources ?? []}
                chunkCountBySource={Object.fromEntries(chunkCountBySource)}
                canDelete={isOwner}
              />
            ),
            profile: (
              <ProfileSummary
                businessName={account?.business_name ?? ""}
                businessSector={account?.business_sector ?? null}
                websiteUrl={account?.website_url ?? null}
                teamSize={account?.team_size ?? null}
              />
            ),
          }}
        />
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <CardTitle>Nasıl çalışır</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Icon size={16} />
                </span>
                <p className="mt-2 text-sm font-medium text-foreground">{step.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
