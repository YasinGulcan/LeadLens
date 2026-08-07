import { redirect } from "next/navigation";
import { FileText, Sparkles, Send } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { getSetupStatus } from "@/lib/setup-checklist";
import { CardTitle } from "@/components/ui";
import { SetupPageContent } from "./SetupPageContent";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  { icon: FileText, title: "Form dolduruluyor", body: "Müşteriniz web sitenizdeki formu dolduruyor." },
  { icon: Sparkles, title: "Otomatik analiz", body: "Site taranıyor, bilgi tabanınızla eşleştirilip skorlanıyor." },
  { icon: Send, title: "Satışa bildirim", body: "Ekibiniz skor ve önerilen ürünle birlikte lead'i alıyor." },
];

export default async function SetupPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const status = await getSetupStatus(session.accountId);

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-foreground">Kurulum Paneli</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {status.completedCount}/{status.totalCount} adım tamamlandı.
      </p>

      <div className="mt-6">
        <SetupPageContent
          steps={status.steps}
          requiredDone={status.requiredDone}
          completedCount={status.completedCount}
          totalCount={status.totalCount}
        />
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <CardTitle>Nasıl çalışır</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title}>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <Icon size={15} className="text-accent" />
                </div>
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
