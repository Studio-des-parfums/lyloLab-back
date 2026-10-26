import { hashPassword, verifyPassword } from './password.js';
import { signToken, verifyToken } from './token.js';

describe('password', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored).not.toContain('correct horse');
    await expect(verifyPassword('correct horse', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong horse', stored)).resolves.toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects malformed stored values', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
  });
});

describe('token', () => {
  const previousSecret = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256';
  });
  afterAll(() => {
    process.env.JWT_SECRET = previousSecret;
  });

  it('round-trips the user id', () => {
    expect(verifyToken(signToken('user-1'))).toBe('user-1');
  });

  it('rejects a tampered payload', () => {
    const [header, , signature] = signToken('user-1').split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
    expect(verifyToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const token = signToken('user-1');
    process.env.JWT_SECRET = 'another-secret-that-is-long-enough-too';
    expect(verifyToken(token)).toBeNull();
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256';
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    const token = signToken('user-1');
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(verifyToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it('rejects garbage', () => {
    expect(verifyToken('abc')).toBeNull();
    expect(verifyToken('a.b.c')).toBeNull();
  });
});
