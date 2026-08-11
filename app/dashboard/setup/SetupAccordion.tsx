"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Link2, Filter, Database, Settings } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import type { SetupStep, SetupStepKey } from "@/lib/setup-checklist";

const STEP_ICON: Record<SetupStepKey, typeof Link2> = {
  mail: Link2,
  filters: Filter,
  "knowledge-base": Database,
  profile: Settings,
};

function firstIncompleteKey(steps: SetupStep[]): SetupStepKey | null {
  return steps.find((s) => !s.done)?.key ?? null;
}

/**
 * Tek seferde sadece bir adım açık — Mail Kaynağı ve Bilgi Tabanı adımlarının
 * içeriği tek başına bile uzun (birden fazla kart/form/tablo), hepsi aynı
 * anda açık olsa sayfa çok uzayıp rehberli-kurulum hissini kaybederdi. Bir
 * adım tamamlanınca (props'taki `steps.done` sunucu tarafında yeniden
 * hesaplanıp aşağı aktığında) otomatik olarak sıradaki eksik adıma geçilir.
 */
export function SetupAccordion({ steps, content }: { steps: SetupStep[]; content: Record<SetupStepKey, ReactNode> }) {
  const [openKey, setOpenKey] = useState<SetupStepKey | null>(() => firstIncompleteKey(steps));
  const prevDoneRef = useRef<Record<string, boolean>>(Object.fromEntries(steps.map((s) => [s.key, s.done])));

  useEffect(() => {
    const prevDone = prevDoneRef.current;
    const justCompletedOpenStep = openKey !== null && !prevDone[openKey] && steps.find((s) => s.key === openKey)?.done;
    if (justCompletedOpenStep) {
      setOpenKey(firstIncompleteKey(steps));
    }
    prevDoneRef.current = Object.fromEntries(steps.map((s) => [s.key, s.done]));
  }, [steps, openKey]);

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const Icon = STEP_ICON[step.key];
        const isOpen = openKey === step.key;
        return (
          <Card key={step.key} className="overflow-hidden p-0">
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : step.key)}
              className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-surface-hover"
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
              <ChevronDown
                size={18}
                className={`mt-1.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && <div className="border-t border-border p-4">{content[step.key]}</div>}
          </Card>
        );
      })}
    </div>
  );
}
