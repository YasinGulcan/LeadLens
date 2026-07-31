import { NextRequest, NextResponse } from "next/server";
import { sendFormSubmissionEmail } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const websiteUrl = typeof body?.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!websiteUrl) {
    return NextResponse.json({ error: "website_url zorunlu." }, { status: 400 });
  }

  try {
    await sendFormSubmissionEmail({ name, phone, websiteUrl, message });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Form gönderim maili başarısız:", errorMessage);
    return NextResponse.json({ error: "Gönderim başarısız, tekrar deneyin." }, { status: 500 });
  }
}
