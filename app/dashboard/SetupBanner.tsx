import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card, Button } from "@/components/ui";
import type { SetupStatus } from "@/lib/setup-checklist";
import { DismissChecklistButton } from "./DismissChecklistButton";

/** Ana Ekran'ın üstündeki ince kurulum uyarısı — tam checklist artık `/dashboard/setup`'ta, burada sadece bir hatırlatma + yönlendirme var. */
export function SetupBanner({ status }: { status: SetupStatus }) {
  if (status.requiredDone || status.dismissed) return null;

  const mailDone = status.steps.find((s) => s.key === "mail")?.done ?? true;
  const kbDone = status.steps.find((s) => s.key === "knowledge-base")?.done ?? true;
  const missing = [!mailDone && "mail kaynağı", !kbDone && "bilgi tabanı"].filter(Boolean).join(" ve ");

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning/10 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <AlertCircle size={15} className="shrink-0 text-warning" />
        Kurulumunuz eksik ({status.completedCount}/{status.totalCount}) — analiz başlaması için {missing} gerekiyor.
      </p>
      <div className="flex items-center gap-2">
        <Link href="/dashboard/setup">
          <Button variant="secondary" size="sm">
            Kuruluma Git
          </Button>
        </Link>
        <DismissChecklistButton />
      </div>
    </Card>
  );
}
