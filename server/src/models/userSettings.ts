import { db } from '../db/database';
import { decrypt_api_key, maybe_encrypt_api_key } from '../services/apiKeyCrypto';

/**
 * Retrieve an encrypted setting value for a user and decrypt it.
 * Returns null if the key does not exist or decryption fails.
 */
export function getEncryptedKey(userId: number, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, key) as { value: string } | undefined;
  if (!row) return null;
  const decrypted = decrypt_api_key(row.value);
  return decrypted;
}

/**
 * Store a setting value encrypted using the same mechanism as other API keys.
 */
export function setEncryptedKey(userId: number, key: string, plainValue: string): void {
  const encrypted = maybe_encrypt_api_key(plainValue);
  db.prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(userId, key, encrypted);
}
