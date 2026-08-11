import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptToken } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";

function getRedirectUri(req: NextRequest): string {
  // start/route.ts ile aynı origin'i üretmeli — token değişimi bu URI'nin
  // Google'a gönderilenle birebir eşleşmesini gerektiriyor.
  return `${new URL(req.url).origin}/api/oauth/gmail/callback`;
}

function errorRedirect(req: NextRequest, message: string, returnTo = "/dashboard/gmail"): NextResponse {
  const url = new URL(returnTo, new URL(req.url).origin);
  url.searchParams.set("connectError", message);
  return NextResponse.redirect(url);
}

/**
 * Google'ın "Mail Kaynağını Bağla" onayından sonra geri yönlendirdiği adres.
 * Kimlik doğrulama (giriş/kayıt) artık email+OTP ile ayrı olduğundan, bu
 * route SADECE state'te imzalanmış accountId'nin Gmail bağlantısını
 * kurar/günceller — bkz. app/api/oauth/gmail/start.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) return errorRedirect(req, `Google yetkilendirmeyi reddetti: ${oauthError}`);
  if (!code || !state) return errorRedirect(req, "code/state parametreleri eksik.");

  const parsedState = verifyOAuthState(state);
  if (!parsedState) return errorRedirect(req, "Geçersiz veya bozulmuş state — yetkilendirme reddedildi.");
  const { accountId, returnTo } = parsedState;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return errorRedirect(req, "GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET tanımlı değil.", returnTo);

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, getRedirectUri(req));

  let tokens;
  try {
    ({ tokens } = await oauth2Client.getToken(code));
  } catch (err) {
    return errorRedirect(req, err instanceof Error ? err.message : String(err), returnTo);
  }

  if (!tokens.refresh_token) {
    return errorRedirect(
      req,
      "refresh_token alınamadı — bu hesap için muhtemelen zaten izin verilmişti. myaccount.google.com/permissions üzerinden erişimi iptal edip tekrar deneyin.",
      returnTo
    );
  }

  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  let connectedEmail: string | null | undefined;
  try {
    const profile = await gmail.users.getProfile({ userId: "me" });
    connectedEmail = profile.data.emailAddress;
  } catch (err) {
    return errorRedirect(req, `Profil okunamadı: ${err instanceof Error ? err.message : String(err)}`, returnTo);
  }
  if (!connectedEmail) return errorRedirect(req, "Bağlanan hesabın e-postası okunamadı.", returnTo);

  const encryptedRefreshToken = encryptToken(tokens.refresh_token);

  const { error: upsertError } = await supabase.from("gmail_connections").upsert({
    account_id: accountId,
    connected_email: connectedEmail,
    encrypted_refresh_token: encryptedRefreshToken,
    scopes: tokens.scope ?? null,
    connected_at: new Date().toISOString(),
    disconnected_at: null,
  });
  if (upsertError) {
    const message = upsertError.code === "23505" ? "Bu Gmail adresi zaten başka bir hesaba bağlı." : upsertError.message;
    return errorRedirect(req, message, returnTo);
  }
  await supabase.from("accounts").update({ status: "connected" }).eq("id", accountId);

  return NextResponse.redirect(new URL(returnTo, new URL(req.url).origin));
}
