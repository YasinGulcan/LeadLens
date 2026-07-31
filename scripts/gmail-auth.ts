import http from "node:http";
import fs from "node:fs";
import { google } from "googleapis";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const ENV_PATH = ".env.local";

/**
 * Tek seferlik yerel OAuth akışı: GMAIL_CLIENT_ID/SECRET kullanarak tarayıcı
 * üzerinden izin ister, dönen refresh_token'ı doğrudan .env.local'a yazar.
 * Token hiçbir zaman konsola/log'a yazdırılmaz — sohbete de hiç girmez.
 */
async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Önce GMAIL_CLIENT_ID ve GMAIL_CLIENT_SECRET .env.local'a eklenmeli.");
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  console.log("\n=== Bu URL'i tarayıcıda açın ve test Gmail hesabınızla giriş yapın ===\n");
  console.log(authUrl);
  console.log(`\nYanıt bekleniyor (http://localhost:${PORT})...\n`);

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.end("Yetkilendirme reddedildi. Terminale dönebilirsiniz.");
        server.close();
        reject(new Error(error));
        return;
      }
      if (authCode) {
        res.end("Yetkilendirme tamamlandı, bu sekmeyi kapatabilirsiniz.");
        server.close();
        resolve(authCode);
      }
    });
    server.listen(PORT);
  });

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "\nrefresh_token alınamadı — muhtemelen bu hesap için zaten izin verilmişti.\n" +
        "myaccount.google.com/permissions üzerinden bu uygulamanın erişimini iptal edip tekrar deneyin."
    );
    process.exit(1);
  }

  let envContent = fs.readFileSync(ENV_PATH, "utf-8");
  envContent = envContent.includes("GMAIL_REFRESH_TOKEN=")
    ? envContent.replace(/GMAIL_REFRESH_TOKEN=.*/g, `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
    : `${envContent}\nGMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`;
  fs.writeFileSync(ENV_PATH, envContent);

  console.log("\n✓ GMAIL_REFRESH_TOKEN .env.local dosyasına yazıldı (ekrana basılmadı).");
}

main().catch((err) => {
  console.error("HATA:", err.message);
  process.exit(1);
});
