import { getResendClient, getResendFromAddress, escapeHtml } from "./resend";

/** Hesap sahibinin Gmail bağlantısına bağımlı olmadan (henüz Mail Kaynağı kurulmamış olabilir) her zaman gönderilebilsin diye Resend kullanır — bkz. lib/otp-email.ts'teki aynı gerekçe. */
export async function sendTeamInviteEmail(businessName: string, inviteEmail: string): Promise<void> {
  const appUrl = process.env.APP_URL;
  const loginUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/login` : "";

  const subject = `${businessName} sizi LeadLens ekibine davet etti`;
  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; color: #1f2937;">
      <h2>Ekibe davet edildiniz 👋</h2>
      <p><strong>${escapeHtml(businessName)}</strong> sizi LeadLens panelinde ekip üyesi olarak eklemek istiyor.</p>
      <p>Katılmak için LeadLens&apos;e gidip bu davetin gönderildiği (<strong>${escapeHtml(inviteEmail)}</strong>)
      e-posta adresiyle giriş sayfasında "Şifremi Unuttum"u kullanın — e-postanıza gönderilecek kodu girip
      kendi şifrenizi belirleyin, sonraki girişlerde bu şifreyi kullanırsınız.</p>
      ${loginUrl ? `<p style="margin-top:20px;"><a href="${escapeHtml(loginUrl)}" style="color:#2563eb;">Giriş yap</a></p>` : ""}
    </div>
  `.trim();

  const { error } = await getResendClient().emails.send({
    from: getResendFromAddress(),
    to: inviteEmail,
    subject,
    html,
  });
  if (error) throw new Error(`Davet e-postası gönderilemedi: ${error.message}`);
}

export async function sendOwnershipTransferInviteEmail(businessName: string, newOwnerEmail: string): Promise<void> {
  const appUrl = process.env.APP_URL;
  const loginUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/login` : "";

  const subject = `${businessName} sahipliğini size devretmek istiyor`;
  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; color: #1f2937;">
      <h2>Hesap sahipliği size devrediliyor 🔑</h2>
      <p><strong>${escapeHtml(businessName)}</strong> hesabının sahipliğini size devretmek istiyor.</p>
      <p>Devri tamamlamak için LeadLens&apos;e gidip bu davetin gönderildiği (<strong>${escapeHtml(newOwnerEmail)}</strong>)
      e-posta adresinizle giriş yapın (şifreniz yoksa "Şifremi Unuttum" ile önce bir şifre belirleyin).</p>
      <p style="color:#6b7280; font-size:13px;">Bunu yaptığınızda hesabın veri sahibi siz olursunuz ve eski sahip
      otomatik olarak sıradan bir ekip üyesine dönüşür.</p>
      ${loginUrl ? `<p style="margin-top:20px;"><a href="${escapeHtml(loginUrl)}" style="color:#2563eb;">Giriş yap</a></p>` : ""}
    </div>
  `.trim();

  const { error } = await getResendClient().emails.send({
    from: getResendFromAddress(),
    to: newOwnerEmail,
    subject,
    html,
  });
  if (error) throw new Error(`Sahiplik devri e-postası gönderilemedi: ${error.message}`);
}
