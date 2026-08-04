import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM için önerilen boyut

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY ortam değişkeni tanımlı olmalı.");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY 32 byte'lık (base64) bir AES-256 anahtarı olmalı.");
  }
  return buf;
}

/**
 * Müşteri Gmail refresh token'ları gibi üçüncü taraf kimlik bilgilerini
 * düz metin saklamamak için AES-256-GCM ile şifreler. Çıktı
 * "iv:authTag:ciphertext" (hepsi base64) formatında tek bir string.
 */
export function encryptToken(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptToken(cipherText: string): string {
  const [ivB64, authTagB64, dataB64] = cipherText.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Geçersiz şifreli token formatı.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf-8");
}
