import { createHmac, timingSafeEqual } from 'node:crypto';

// Session tokens are HS256 JWTs carrying only the user id.
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET manquant ou trop court dans backend/.env (${MIN_SECRET_LENGTH} caractères minimum).`,
    );
  }
  return value;
}

/** Fails fast at startup instead of on the first login. */
export function assertAuthConfigured(): void {
  secret();
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function signToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  })}`;
  return `${head}.${sign(head)}`;
}

/** Returns the user id of a valid, unexpired token, or null. */
export function verifyToken(token: string): string | null {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;

  const expected = Buffer.from(sign(`${header}.${payload}`));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null;
    return claims.exp > Date.now() / 1000 ? claims.sub : null;
  } catch {
    return null;
  }
}
