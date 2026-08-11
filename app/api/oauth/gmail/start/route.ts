import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { signOAuthState } from "@/lib/oauth-state";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";

// scripts/gmail-auth.ts ile aynı scope'lar: okuma+etiketleme (lead mailini
// yakalamak için) ve gönderme (form relay + analiz raporu için). Kimlik
// doğrulama (giriş/kayıt) artık email+OTP ile ayrı — bu akış SADECE oturumu
// zaten açık bir hesabın Mail Kaynağı'nı (hangi Gmail'den lead okunacağını)
// bağlamak/değiştirmek için kullanılır, bkz. app/dashboard/gmail/page.tsx.
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"];

function getRedirectUri(req: NextRequest): string {
  // Her zaman isteğin geldiği origin kullanılır (yerelde localhost, canlıda
  // gerçek domain) — Google'a bildirdiğimiz redirect_uri, akışın gerçekten
  // çalıştığı yerle eşleşmeli. APP_URL burada kullanılmaz (o sadece e-posta
  // linkleri gibi statik referanslar için).
  return `${new URL(req.url).origin}/api/oauth/gmail/callback`;
}

/**
 * "Mail Kaynağını Bağla" — sadece oturumu açık, hesabın SAHİBİ olan kişi
 * kullanabilir (davetli ekip üyeleri değil). `accountId` zorunlu; anonim/
 * kayıt akışı yok artık (bkz. email+OTP tabanlı /signup, /login).
 */
export async function GET(req: NextRequest) {
  const requestedAccountId = req.nextUrl.searchParams.get("accountId");
  if (!requestedAccountId) {
    return NextResponse.json({ error: "accountId zorunlu." }, { status: 400 });
  }

  const session = await getSessionInfo();
  const isOwner = session?.accountId === requestedAccountId && (await isAccountOwner(requestedAccountId, session.email));
  if (!isOwner) {
    return NextResponse.json({ error: "Bu hesap için yetkiniz yok — sadece hesap sahibi Gmail bağlantısını değiştirebilir." }, { status: 403 });
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET tanımlı değil." }, { status: 500 });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, getRedirectUri(req));
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // refresh_token her seferinde dönsün diye
    scope: SCOPES,
    state: signOAuthState(requestedAccountId),
  });

  return NextResponse.redirect(authUrl);
}
