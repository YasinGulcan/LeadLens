import { NextRequest } from "next/server";
import { supabase } from "./supabase";

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/** Vercel/proxy arkasında gerçek istemci IP'sini okur. */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "bilinmeyen";
}

/**
 * IP başına saatte en fazla RATE_LIMIT_MAX_ATTEMPTS deneme — kötü niyetli
 * script'lerin formu tekrar tekrar doldurup her seferinde gerçek para
 * harcatmasını (Firecrawl+OpenAI+Claude) önler. Her çağrı bir deneme kaydeder;
 * limit aşılmışsa false döner.
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("form_submission_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);

  await supabase.from("form_submission_attempts").insert({ ip });

  return (count ?? 0) < RATE_LIMIT_MAX_ATTEMPTS;
}

const MIN_SUBMIT_SECONDS = 2;

/** Form sayfası açıldıktan çok kısa süre sonra gönderim yapıldıysa bot şüphesi. */
export function isSuspiciouslyFast(formRenderedAt: unknown): boolean {
  const renderedAt = typeof formRenderedAt === "number" ? formRenderedAt : null;
  if (!renderedAt) return true; // alan hiç gelmemiş — script ile doğrudan API çağrısı olabilir
  return Date.now() - renderedAt < MIN_SUBMIT_SECONDS * 1000;
}
