import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from the provided string.
 * If the key is already 32 bytes it's used as-is; otherwise we pad/truncate.
 */
function normalizeKey(key: string): Buffer {
  const buf = Buffer.from(key, 'utf8');
  if (buf.length === 32) return buf;
  const padded = Buffer.alloc(32);
  buf.copy(padded);
  return padded;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string in the format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuf = normalizeKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuf, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a ciphertext string produced by `encrypt()`.
 * Input format: iv:authTag:ciphertext (all base64-encoded segments)
 */
export function decrypt(ciphertext: string, key: string): string {
  const keyBuf = normalizeKey(key);
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = parts[2];

  const decipher = createDecipheriv(ALGORITHM, keyBuf, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
