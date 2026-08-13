import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { saveNamedPrompt } from "@/lib/prompt-library";

/** `/dashboard/prompt`'taki "Farklı Kaydet" — mevcut aktif prompta dokunmadan, metni isimlendirip kütüphaneye ekler. Sadece hesap sahibi düzenleyebilir. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi sistem promptunu düzenleyebilir." }, { status: 403 });
  }
  const accountId = session.accountId;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const promptText = typeof body?.promptText === "string" ? body.promptText.trim() : "";

  if (!name) return NextResponse.json({ error: "Prompt için bir isim girin." }, { status: 400 });
  if (!promptText) return NextResponse.json({ error: "Kaydedilecek prompt metni boş olamaz." }, { status: 400 });

  try {
    const saved = await saveNamedPrompt(accountId, name, promptText);
    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
