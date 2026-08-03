import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_VALUES = ["helpful", "not_helpful", null];

/**
 * Admin panelinden satış ekibi Claude'un önerisini 👍/👎 ile değerlendirir.
 * Aynı değere tekrar tıklamak seçimi kaldırır (null) — bu yüzden feedback
 * null da olabilir.
 */
export async function POST(req: NextRequest) {
  const { leadId, feedback } = await req.json().catch(() => ({}));

  if (typeof leadId !== "string") {
    return NextResponse.json({ error: "leadId gerekli." }, { status: 400 });
  }
  if (!VALID_VALUES.includes(feedback)) {
    return NextResponse.json({ error: "feedback 'helpful', 'not_helpful' ya da null olmalı." }, { status: 400 });
  }

  const { error } = await supabase
    .from("leads")
    .update({ sales_feedback: feedback, sales_feedback_at: feedback ? new Date().toISOString() : null })
    .eq("id", leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
