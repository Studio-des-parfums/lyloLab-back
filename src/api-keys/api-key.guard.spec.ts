import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';
import { generateApiKey, hashApiKey } from './api-key.util.js';

function contextWith(headers: Record<string, string>) {
  const request: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('generateApiKey', () => {
  it('returns a key whose hash matches and never equals it', () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key.startsWith('lylo_live_')).toBe(true);
    expect(key.startsWith(prefix)).toBe(true);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).not.toContain(key);
  });
});

describe('ApiKeyGuard', () => {
  const { key, hash } = generateApiKey();
  const prisma = {
    apiKey: {
      findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => {
        if (where.keyHash === hash) return { id: 'k1', teamId: 't1', name: 'Gestionnaire', revokedAt: null };
        if (where.keyHash === hashApiKey('revoked')) return { id: 'k2', teamId: 't1', name: 'Old', revokedAt: new Date() };
        return null;
      }),
    },
  };
  const guard = new ApiKeyGuard(prisma as never);

  it('accepts a valid key and attaches the client', async () => {
    const { context, request } = contextWith({ 'x-api-key': key });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.apiClient).toEqual({ apiKeyId: 'k1', teamId: 't1', name: 'Gestionnaire' });
  });

  it('rejects a missing key', async () => {
    await expect(guard.canActivate(contextWith({}).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown key', async () => {
    await expect(guard.canActivate(contextWith({ 'x-api-key': 'nope' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a revoked key', async () => {
    await expect(guard.canActivate(contextWith({ 'x-api-key': 'revoked' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
