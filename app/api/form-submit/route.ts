import { NextRequest, NextResponse, after } from "next/server";
import { sendFormSubmissionEmail } from "@/lib/gmail";
import { runFullPipeline } from "@/lib/pipeline";

export const maxDuration = 60; // after() ile arka planda çalışan pipeline için (scrape+analiz+bildirim)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const websiteUrl = typeof body?.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const consentGiven = body?.consentGiven === true;

  if (!websiteUrl) {
    return NextResponse.json({ error: "website_url zorunlu." }, { status: 400 });
  }
  if (!consentGiven) {
    return NextResponse.json(
      { error: "Kişisel verilerin işlenmesine onay vermeden gönderim yapılamaz (KVKK)." },
      { status: 400 }
    );
  }

  try {
    await sendFormSubmissionEmail({ name, phone, websiteUrl, message, consentGivenAt: new Date().toISOString() });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Form gönderim maili başarısız:", errorMessage);
    return NextResponse.json({ error: "Gönderim başarısız, tekrar deneyin." }, { status: 500 });
  }

  // Kullanıcıya hemen yanıt dönülür ("Teşekkürler" ekranı); pipeline yanıt
  // gönderildikten sonra arka planda çalışır — müşteri günlük cron'u
  // beklemeden dakikalar içinde rapor gitmiş olur. Günlük cron
  // (/api/cron/run-pipeline) bunun yedeği: bu tetikleme başarısız olursa
  // ya da Gmail'e başka bir yoldan (örn. gelecekteki ayrı bir form sitesi)
  // mail düşerse, en geç ertesi gün yine yakalanır.
  after(async () => {
    try {
      await runFullPipeline();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Gerçek zamanlı pipeline tetiklemesi başarısız:", message);
    }
  });

  return NextResponse.json({ ok: true });
}
