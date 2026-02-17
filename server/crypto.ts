import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for encryption");
  }
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  if (!encryptedText.includes(":")) return encryptedText;
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !encrypted || ivHex.length !== 32) return encryptedText;
  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText;
  }
}

export function maskApiKey(encryptedKey: string | null): string | null {
  if (!encryptedKey) return null;
  try {
    const decrypted = decrypt(encryptedKey);
    if (decrypted.length <= 8) return "****" + decrypted.slice(-2);
    return "****" + decrypted.slice(-4);
  } catch {
    return "****";
  }
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 2 && parts[0].length === 32 && /^[0-9a-f]+$/.test(parts[0]);
}
