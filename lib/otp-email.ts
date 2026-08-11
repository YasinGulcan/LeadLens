import { getResendClient, getResendFromAddress, escapeHtml } from "./resend";
import type { OtpPurpose } from "./otp";

export async function sendOtpEmail(email: string, code: string, purpose: OtpPurpose): Promise<void> {
  const subject = purpose === "signup_verification" ? "LeadLens kayıt doğrulama kodunuz" : "LeadLens şifre sıfırlama kodunuz";
  const intro = purpose === "signup_verification" ? "Kaydınızı tamamlamak için" : "Şifrenizi sıfırlamak için";

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; color: #1f2937;">
      <h2 style="margin-bottom: 4px;">LeadLens</h2>
      <p style="color:#6b7280;">${intro} aşağıdaki kodu kullanın:</p>
      <p style="font-size:32px; font-weight:700; letter-spacing:6px; background:#f3f4f6; padding:16px 20px; border-radius:8px; text-align:center; margin:20px 0;">
        ${escapeHtml(code)}
      </p>
      <p style="color:#6b7280; font-size:13px;">Kod 10 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
    </div>
  `.trim();

  const { error } = await getResendClient().emails.send({
    from: getResendFromAddress(),
    to: email,
    subject,
    html,
  });
  if (error) throw new Error(`Kod e-postası gönderilemedi: ${error.message}`);
}
