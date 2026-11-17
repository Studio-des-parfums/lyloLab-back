import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export type WebhookEvent =
  | 'formulation_request.taken'
  | 'formulation_request.started'
  | 'formulation_request.completed';

const TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [0, 2_000, 10_000];

/**
 * Signature : `t=<timestamp>,v1=<hex>` avec v1 = HMAC-SHA256(secret, `${t}.${body}`).
 * Le timestamp signé permet au destinataire de rejeter les rejeux.
 */
export function signWebhook(secret: string, body: string, timestamp: number): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Envoi en arrière-plan : n'échoue jamais et ne bloque jamais l'appelant. */
  notify(apiKeyId: string | null, event: WebhookEvent, data: unknown): void {
    if (!apiKeyId) return;
    void this.deliver(apiKeyId, event, data).catch((err) =>
      this.logger.error(`Webhook ${event} (clé ${apiKeyId}) : ${String(err)}`),
    );
  }

  async deliver(apiKeyId: string, event: WebhookEvent, data: unknown, sleep = defaultSleep): Promise<boolean> {
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { webhookUrl: true, webhookSecret: true, revokedAt: true },
    });
    if (!key?.webhookUrl || key.revokedAt) return false;

    const id = randomUUID();
    const body = JSON.stringify({ id, event, createdAt: new Date().toISOString(), data });

    for (const delay of RETRY_DELAYS_MS) {
      if (delay) await sleep(delay);
      try {
        const res = await fetch(key.webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-lylo-event': event,
            'x-lylo-delivery': id,
            'x-lylo-signature': signWebhook(key.webhookSecret, body, Math.floor(Date.now() / 1000)),
          },
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return true;
        // 4xx (hors 408/429) : le destinataire refuse, inutile d'insister.
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) break;
        this.logger.warn(`Webhook ${event} → HTTP ${res.status}, nouvel essai`);
      } catch (err) {
        this.logger.warn(`Webhook ${event} → ${String(err)}, nouvel essai`);
      }
    }
    this.logger.error(`Webhook ${event} (livraison ${id}) abandonné pour la clé ${apiKeyId}`);
    return false;
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
