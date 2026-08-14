import { NextRequest, NextResponse } from "next/server";
import { acceptTeamMembership, clearPendingOwnerTransfer } from "@/lib/accounts";
import { getPendingMembership, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { provisionAndSignIn, signInWithoutPassword } from "@/lib/auth-identity";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";

/** `/confirm-join`'deki "Evet" — burada gerçekten üyelik ya da sahiplik devri uygulanır. */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const pending = await getPendingMembership();
  if (!pending) {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", "Oturum süresi doldu, tekrar deneyin.");
    return NextResponse.redirect(url);
  }

  const { accountId, email, previousOwnerEmail } = pending;

  if (pending.type === "transfer") {
    // Devralan kişi zaten bir üye olarak bir auth.users kimliği/şifresi
    // edinmişse, o kimlik sahipliğe taşınır — aksi halde ESKİ sahibin
    // owner_user_id'si kalıp yeni sahibin e-postasıyla eşleşmiş olurdu,
    // bu bir güvenlik açığı olurdu.
    const [{ data: transferringMember }, { data: currentAccount }] = await Promise.all([
      supabase.from("account_members").select("user_id, password_set_at").eq("account_id", accountId).eq("email", email).maybeSingle(),
      supabase.from("accounts").select("owner_user_id, owner_password_set_at").eq("id", accountId).single(),
    ]);

    const { error: transferError } = await supabase
      .from("accounts")
      .update({
        owner_email: email,
        owner_full_name: null,
        owner_phone: null,
        owner_user_id: transferringMember?.user_id ?? null,
        owner_password_set_at: transferringMember?.password_set_at ?? null,
      })
      .eq("id", accountId);
    if (transferError) {
      const url = new URL("/", origin);
      url.searchParams.set("connectError", transferError.message);
      return NextResponse.redirect(url);
    }

    if (previousOwnerEmail && previousOwnerEmail !== email) {
      const { error: demoteError } = await supabase.from("account_members").insert({
        account_id: accountId,
        email: previousOwnerEmail,
        user_id: currentAccount?.owner_user_id ?? null,
        password_set_at: currentAccount?.owner_password_set_at ?? null,
      });
      // account_members.email global olarak unique — eski sahip zaten
      // başka bir hesapta üye/sahipse (23505) bu beklenir, sessizce
      // atlanır (zaten başka bir yerde erişimi var). Başka bir hata ise
      // (geçici DB hatası vb.) eski sahip ne sahip ne üye kalıp "yetim"
      // bir kimliğe düşer — devrin kendisini engellemiyoruz (yeni sahibin
      // erişimi öncelikli) ama loglanmazsa fark edilmesi imkansız olur.
      if (demoteError && demoteError.code !== "23505") {
        console.error(
          `Sahiplik devri: eski sahip (${previousOwnerEmail}) üye olarak eklenemedi, hesapsız/yetim kalmış olabilir:`,
          demoteError.message
        );
      }
    }
    await supabase.from("account_members").delete().eq("account_id", accountId).eq("email", email);
    try {
      await clearPendingOwnerTransfer(accountId);
    } catch (err) {
      const url = new URL("/", origin);
      url.searchParams.set("connectError", err instanceof Error ? err.message : String(err));
      return NextResponse.redirect(url);
    }
    await logActivity(accountId, email, "Sahipliği devraldı", previousOwnerEmail);
  } else {
    await acceptTeamMembership(accountId, email);
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("onboarded_at, owner_user_id, owner_password_set_at")
    .eq("id", accountId)
    .single();

  let existingUserId: string | null;
  let hasRealPassword: boolean;
  if (pending.type === "transfer") {
    existingUserId = account?.owner_user_id ?? null;
    hasRealPassword = !!account?.owner_password_set_at;
  } else {
    const { data: memberRow } = await supabase
      .from("account_members")
      .select("user_id, password_set_at")
      .eq("account_id", accountId)
      .eq("email", email)
      .maybeSingle();
    existingUserId = memberRow?.user_id ?? null;
    hasRealPassword = !!memberRow?.password_set_at;
  }

  try {
    if (existingUserId) {
      // Kimlik zaten kurulu (signup/davet anında oluşturuldu) — parolaya
      // dokunmadan oturum açılır.
      await signInWithoutPassword(email);
    } else {
      // Normalde buraya düşülmemeli (kimlik signup/davet anında zaten
      // kuruluyor) — sadece o adım başarısız olduysa devreye giren bir
      // güvenlik ağı: geçici şifreyle kimlik oluşturulup oturum açılır.
      const userId = await provisionAndSignIn(email, null);
      if (pending.type === "transfer") {
        await supabase.from("accounts").update({ owner_user_id: userId }).eq("id", accountId);
      } else {
        await supabase.from("account_members").update({ user_id: userId }).eq("account_id", accountId).eq("email", email);
      }
    }
  } catch (err) {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(url);
  }

  const destination = !hasRealPassword ? "/set-password" : account?.onboarded_at ? "/dashboard" : "/onboarding";
  const res = NextResponse.redirect(new URL(destination, origin));
  res.cookies.delete(PENDING_MEMBERSHIP_COOKIE);
  return res;
}
