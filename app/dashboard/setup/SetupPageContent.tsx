"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Link2, Filter, Database, Settings, PartyPopper } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";
import type { SetupStep } from "@/lib/setup-checklist";

const STEP_ICON: Record<SetupStep["key"], typeof Link2> = {
  mail: Link2,
  filters: Filter,
  "knowledge-base": Database,
  profile: Settings,
};

export function SetupPageContent({
  steps,
  requiredDone,
  completedCount,
  totalCount,
}: {
  steps: SetupStep[];
  requiredDone: boolean;
  completedCount: number;
  totalCount: number;
}) {
  const [expanded, setExpanded] = useState(!requiredDone);

  if (requiredDone && !expanded) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2.5 text-sm text-foreground">
          <PartyPopper size={18} className="text-accent" />
          Kurulum tamamlandı — {completedCount}/{totalCount} adım tamam.
        </div>
        <Button variant="secondary" size="sm" onClick={() => setExpanded(true)}>
          Yeniden gözden geçir
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requiredDone && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <PartyPopper size={15} className="text-accent" />
          Zorunlu adımlar tamam — geri kalanlar isteğe bağlı, dilediğinizde güncelleyebilirsiniz.
        </p>
      )}
      {steps.map((step, i) => {
        const Icon = STEP_ICON[step.key];
        return (
          <Link key={step.key} href={step.href}>
            <Card
              className={`flex items-start gap-4 p-4 transition-colors hover:border-border-subtle hover:bg-surface-hover ${
                step.done ? "opacity-70" : ""
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  step.done ? "bg-accent text-white" : "bg-surface-hover text-muted-foreground"
                }`}
              >
                {step.done ? <Check size={16} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon size={15} className="shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{step.title}</span>
                  <Badge variant={step.badgeVariant}>{step.badgeLabel}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.why}</p>
              </div>
              <ChevronRight size={18} className="mt-1.5 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
