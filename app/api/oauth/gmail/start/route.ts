import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { signOAuthState } from "@/lib/oauth-state";
import { getSessionAccountId } from "@/lib/account-session";

// scripts/gmail-auth.ts ile aynı scope'lar: okuma+etiketleme (lead mailini
// yakalamak için) ve gönderme (form relay + analiz raporu için). Ayrı bir
// "Sign in with Google" scope'una gerek yok — bağlanan Gmail adresinin
// kendisi (callback'te gmail.users.getProfile() ile okunuyor) kimlik olarak
// kullanılıyor.
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"];

// Hesabı henüz bilinmeyen (kayıt/giriş) akışlar için state'e imzalanan sentinel.
const NEW_ACCOUNT_STATE = "new";

function getRedirectUri(req: NextRequest): string {
  // Her zaman isteğin geldiği origin kullanılır (yerelde localhost, canlıda
  // gerçek domain) — Google'a bildirdiğimiz redirect_uri, akışın gerçekten
  // çalıştığı yerle eşleşmeli. APP_URL burada kullanılmaz (o sadece e-posta
  // linkleri gibi statik referanslar için).
  return `${new URL(req.url).origin}/api/oauth/gmail/callback`;
}

/**
 * İki modda çalışır:
 * - `accountId` yoksa: herkese açık "Google ile Bağlan" girişi (`/`) —
 *   callback, bağlanan Gmail adresine göre mevcut hesaba giriş yapar ya da
 *   yeni hesap açar.
 * - `accountId` varsa: `/dashboard`'daki "Gmail'i yeniden bağla" — sadece
 *   çağıranın kendi oturumu o hesaba aitse kabul edilir (başkasının
 *   hesabına token bağlanmasın diye).
 */
export async function GET(req: NextRequest) {
  const requestedAccountId = req.nextUrl.searchParams.get("accountId");

  let stateAccountId: string = NEW_ACCOUNT_STATE;
  if (requestedAccountId) {
    const sessionAccountId = await getSessionAccountId();
    if (sessionAccountId !== requestedAccountId) {
      return NextResponse.json({ error: "Bu hesap için yetkiniz yok." }, { status: 403 });
    }
    stateAccountId = requestedAccountId;
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
    state: signOAuthState(stateAccountId),
  });

  return NextResponse.redirect(authUrl);
}
