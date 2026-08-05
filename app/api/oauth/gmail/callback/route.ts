import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptToken } from "@/lib/crypto";
import { createAccountSessionValue, ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";
import {
  generateUniqueSlug,
  findAccountIdByMemberEmail,
  getAccountOwnerEmail,
  getPendingOwnerEmail,
  clearPendingOwnerTransfer,
  acceptTeamMembership,
} from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";

const NEW_ACCOUNT_STATE = "new";

function getRedirectUri(req: NextRequest): string {
  // start/route.ts ile aynı origin'i üretmeli — token değişimi bu URI'nin
  // Google'a gönderilenle birebir eşleşmesini gerektiriyor.
  return `${new URL(req.url).origin}/api/oauth/gmail/callback`;
}

function errorRedirect(req: NextRequest, message: string): NextResponse {
  const url = new URL("/", new URL(req.url).origin);
  url.searchParams.set("connectError", message);
  return NextResponse.redirect(url);
}

function withSessionCookie(res: NextResponse, accountId: string, email: string): NextResponse {
  res.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSessionValue(accountId, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/**
 * Google'ın kullanıcıyı onaydan sonra geri yönlendirdiği adres. "Google ile
 * Bağlan" hem kayıt hem giriş hem Gmail bağlantısı olduğu için burada dört
 * senaryo var: (1) `/dashboard`'dan "yeniden bağla" — state gerçek bir
 * accountId taşıyor; (2) bağlanan Gmail adresi bir hesabın sahibiyse — o
 * hesaba giriş; (3) bağlanan Gmail adresi davetli bir ekip üyesiyse — token
 * hiç saklanmadan sadece kimlik doğrulanıp o hesaba giriş yapılır; (4) hiç
 * kayıtlı değilse — yeni hesap açılır.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) return errorRedirect(req, `Google yetkilendirmeyi reddetti: ${oauthError}`);
  if (!code || !state) return errorRedirect(req, "code/state parametreleri eksik.");

  const stateAccountId = verifyOAuthState(state);
  if (!stateAccountId) return errorRedirect(req, "Geçersiz veya bozulmuş state — yetkilendirme reddedildi.");

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return errorRedirect(req, "GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET tanımlı değil.");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, getRedirectUri(req));

  let tokens;
  try {
    ({ tokens } = await oauth2Client.getToken(code));
  } catch (err) {
    return errorRedirect(req, err instanceof Error ? err.message : String(err));
  }

  if (!tokens.refresh_token) {
    return errorRedirect(
      req,
      "refresh_token alınamadı — bu hesap için muhtemelen zaten izin verilmişti. myaccount.google.com/permissions üzerinden erişimi iptal edip tekrar deneyin."
    );
  }

  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  let connectedEmail: string | null | undefined;
  try {
    const profile = await gmail.users.getProfile({ userId: "me" });
    connectedEmail = profile.data.emailAddress;
  } catch (err) {
    return errorRedirect(req, `Profil okunamadı: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!connectedEmail) return errorRedirect(req, "Bağlanan hesabın e-postası okunamadı.");

  const encryptedRefreshToken = encryptToken(tokens.refresh_token);

  let accountId: string;
  let onboardedAt: string | null;

  if (stateAccountId !== NEW_ACCOUNT_STATE) {
    // /dashboard'dan "yeniden bağla" — mevcut hesabın bağlantısı güncellenir.
    // (Sadece sahip buraya gelebilir — bkz. start/route.ts'teki kontrol.)
    accountId = stateAccountId;
    const { error: upsertError } = await supabase.from("gmail_connections").upsert({
      account_id: accountId,
      connected_email: connectedEmail,
      encrypted_refresh_token: encryptedRefreshToken,
      scopes: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
    });
    if (upsertError) {
      const message =
        upsertError.code === "23505"
          ? "Bu Gmail adresi zaten başka bir hesaba bağlı."
          : upsertError.message;
      return errorRedirect(req, message);
    }
    await supabase.from("accounts").update({ status: "connected" }).eq("id", accountId);

    const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", accountId).single();
    onboardedAt = account?.onboarded_at ?? null;
  } else {
    // Kayıt/giriş: önce bu Gmail adresi bir hesabın SAHİBİ mi diye bakılır.
    const { data: existingConnection } = await supabase
      .from("gmail_connections")
      .select("account_id")
      .eq("connected_email", connectedEmail)
      .maybeSingle();

    if (existingConnection) {
      accountId = existingConnection.account_id;
      const { error: updateError } = await supabase
        .from("gmail_connections")
        .update({ encrypted_refresh_token: encryptedRefreshToken, scopes: tokens.scope ?? null, connected_at: new Date().toISOString() })
        .eq("account_id", accountId);
      if (updateError) return errorRedirect(req, updateError.message);

      const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", accountId).single();
      onboardedAt = account?.onboarded_at ?? null;
    } else {
      // Sahip değilse, davetli bir ekip ÜYESİ mi diye bakılır — üyenin kendi
      // Gmail token'ı hiç saklanmaz/kullanılmaz, sadece kimliği doğrulanmış olur.
      const memberAccountId = await findAccountIdByMemberEmail(connectedEmail);

      if (memberAccountId) {
        accountId = memberAccountId;
        // Davet edilen kişi ilk kez giriş yapıyor olabilir — daveti "kabul edilmiş" işaretle.
        await acceptTeamMembership(accountId, connectedEmail);

        // Bu üye, sahibin "sahipliği devret" ile işaretlediği bekleyen devrin
        // hedefiyse — gerçek devir burada tamamlanır: kendi Gmail'i hesabın
        // yeni veri bağlantısı olur, eski sahip otomatik sıradan üyeye döner.
        const pendingOwnerEmail = await getPendingOwnerEmail(accountId);
        if (pendingOwnerEmail && pendingOwnerEmail === connectedEmail) {
          const previousOwnerEmail = await getAccountOwnerEmail(accountId);

          const { error: transferError } = await supabase.from("gmail_connections").upsert({
            account_id: accountId,
            connected_email: connectedEmail,
            encrypted_refresh_token: encryptedRefreshToken,
            scopes: tokens.scope ?? null,
            connected_at: new Date().toISOString(),
          });
          if (transferError) return errorRedirect(req, transferError.message);

          if (previousOwnerEmail && previousOwnerEmail !== connectedEmail) {
            await supabase.from("account_members").insert({ account_id: accountId, email: previousOwnerEmail });
          }
          await supabase.from("account_members").delete().eq("account_id", accountId).eq("email", connectedEmail);
          await clearPendingOwnerTransfer(accountId);
          await logActivity(accountId, connectedEmail, "Sahipliği devraldı", previousOwnerEmail);
        }

        const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", accountId).single();
        onboardedAt = account?.onboarded_at ?? null;
      } else {
        // Ne sahip ne üye — hiç kayıtlı değil, yeni hesap açılır.
        const placeholderName = connectedEmail.split("@")[0];
        const slug = await generateUniqueSlug(placeholderName);

        const { data: newAccount, error: insertError } = await supabase
          .from("accounts")
          .insert({ business_name: placeholderName, slug, status: "connected" })
          .select("id")
          .single();
        if (insertError || !newAccount) {
          return errorRedirect(req, insertError?.message ?? "Hesap oluşturulamadı.");
        }
        accountId = newAccount.id;
        onboardedAt = null;

        const { error: connError } = await supabase.from("gmail_connections").insert({
          account_id: accountId,
          connected_email: connectedEmail,
          encrypted_refresh_token: encryptedRefreshToken,
          scopes: tokens.scope ?? null,
        });
        if (connError) {
          const message =
            connError.code === "23505" ? "Bu Gmail adresi zaten başka bir hesaba bağlı." : connError.message;
          return errorRedirect(req, message);
        }
      }
    }
  }

  const destination = onboardedAt ? "/dashboard" : "/onboarding";
  return withSessionCookie(NextResponse.redirect(new URL(destination, new URL(req.url).origin)), accountId, connectedEmail);
}
