import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { addTeamMember, getAccountById, isAccountOwner, loadGmailAccount } from "@/lib/accounts";
import { sendTeamInviteEmail } from "@/lib/gmail";
import { logActivity } from "@/lib/activity-log";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `/dashboard/team`'deki davet formu — sadece hesap sahibi ekip üyesi ekleyebilir. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi ekip üyesi ekleyebilir." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }
  if (email === session.email) {
    return NextResponse.json({ error: "Zaten hesap sahibisiniz." }, { status: 400 });
  }

  let member;
  try {
    member = await addTeamMember(session.accountId, email);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  await logActivity(session.accountId, session.email, "Ekip üyesi davet etti", email);

  try {
    const [account, gmailAccount] = await Promise.all([
      getAccountById(session.accountId),
      loadGmailAccount(session.accountId),
    ]);
    if (account && gmailAccount) {
      await sendTeamInviteEmail(gmailAccount, account.businessName, email);
    }
  } catch (err) {
    // Davet kaydı yapıldı ama mail gitmedi — sessizce loglanır, kullanıcı yine de linki paylaşabilir.
    console.error(`Davet maili gönderilemedi (${email}):`, err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, member });
}
