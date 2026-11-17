import { createHash, randomBytes } from 'node:crypto';

/** Format: lylo_live_<48 hex>. Le préfixe affiché permet de reconnaître une clé sans la révéler. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `lylo_live_${randomBytes(24).toString('hex')}`;
  return { key, prefix: key.slice(0, 14), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}
