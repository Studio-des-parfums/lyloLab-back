import { createHmac } from 'node:crypto';
import { RATE_LIMIT, RateLimiter } from './api-key.guard.js';
import { WebhooksService, signWebhook } from './webhooks.service.js';

describe('signWebhook', () => {
  it('signs timestamp and body with HMAC-SHA256', () => {
    const expected = createHmac('sha256', 's').update('100.{"a":1}').digest('hex');
    expect(signWebhook('s', '{"a":1}', 100)).toBe(`t=100,v1=${expected}`);
  });
});

describe('WebhooksService.deliver', () => {
  const key = { webhookUrl: 'https://example.com/hook', webhookSecret: 'whsec_x', revokedAt: null };
  const make = (k: unknown = key) =>
    new WebhooksService({ apiKey: { findUnique: vi.fn(async () => k) } } as never);
  const noSleep = async () => {};
  afterEach(() => vi.unstubAllGlobals());

  it('skips keys without webhook URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await make({ ...key, webhookUrl: null }).deliver('k1', 'formulation_request.taken', {}, noSleep)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries on 5xx then succeeds, with a verifiable signature', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    expect(await make().deliver('k1', 'formulation_request.taken', { id: 'r1' }, noSleep)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1];
    const t = Number(/t=(\d+)/.exec(init.headers['x-lylo-signature'])![1]);
    expect(init.headers['x-lylo-signature']).toBe(signWebhook('whsec_x', init.body, t));
    expect(JSON.parse(init.body)).toMatchObject({ event: 'formulation_request.taken', data: { id: 'r1' } });
  });

  it('does not retry on a 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);
    expect(await make().deliver('k1', 'formulation_request.started', {}, noSleep)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('RateLimiter', () => {
  it('blocks after the limit and resets with the window', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    for (let i = 0; i < RATE_LIMIT.max; i++) expect(limiter.hit('k1')).toBeNull();
    expect(limiter.hit('k1')).toBe(60);
    expect(limiter.hit('k2')).toBeNull();
    now = RATE_LIMIT.windowMs;
    expect(limiter.hit('k1')).toBeNull();
  });
});
