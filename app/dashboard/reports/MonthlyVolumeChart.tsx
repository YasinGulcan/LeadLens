"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyVolumePoint } from "@/lib/reports";

export function MonthlyVolumeChart({ data }: { data: MonthlyVolumePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
          formatter={(value) => (value === "real" ? "Gerçek Lead" : "Elenen")}
        />
        <Bar dataKey="real" stackId="a" fill="var(--accent)" />
        <Bar dataKey="filtered" stackId="a" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
