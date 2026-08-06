"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SCORE_BUCKET_HEX } from "@/lib/score-color";

export interface ScoreBucket {
  label: string;
  count: number;
}

export function ScoreDistributionChart({ buckets }: { buckets: ScoreBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={buckets} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => [`${value} lead`, "Sayı"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {buckets.map((b, i) => (
            <Cell key={b.label} fill={SCORE_BUCKET_HEX[i] ?? SCORE_BUCKET_HEX[SCORE_BUCKET_HEX.length - 1]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
