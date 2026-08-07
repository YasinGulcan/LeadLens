"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import type { AssignableMember } from "@/lib/accounts";

/** Lead detayı "Hızlı Aksiyonlar" içindeki atama kontrolü — StatusSelect'teki "rozet aynı zamanda select" deseninin aynısı. */
export function AssignLead({
  leadId,
  members,
  assignedTo,
  currentEmail,
}: {
  leadId: string;
  members: AssignableMember[];
  assignedTo: string | null;
  currentEmail: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(assignedTo);
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null;
    const previous = current;
    setCurrent(next);
    setPending(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setCurrent(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-sm">
      {current ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
          {current[0]!.toUpperCase()}
        </span>
      ) : (
        <UserRound size={15} className="shrink-0 text-muted-foreground" />
      )}
      <select
        value={current ?? ""}
        onChange={handleChange}
        disabled={pending}
        aria-label="Ekip üyesine ata"
        className="w-full cursor-pointer appearance-none bg-transparent font-medium text-foreground focus:outline-none disabled:opacity-60"
      >
        <option value="" className="bg-surface text-foreground">
          Ekip üyesine ata
        </option>
        {members.map((m) => (
          <option key={m.email} value={m.email} className="bg-surface text-foreground">
            {m.email === currentEmail ? `${m.email} (Sen)` : m.email}
            {m.isOwner ? " · Sahip" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
