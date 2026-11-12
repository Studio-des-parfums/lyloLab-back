import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Resend } from 'resend';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Transactional emails through Resend (RESEND_API_KEY, RESEND_FROM_EMAIL). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private client: Resend | null = null;

  get configured() {
    return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
  }

  async send(message: MailMessage) {
    if (!this.configured) {
      throw new ServiceUnavailableException('Envoi des emails non configuré (RESEND_API_KEY, RESEND_FROM_EMAIL).');
    }
    this.client ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await this.client.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      ...message,
    });
    if (error) {
      this.logger.error(`Envoi à ${message.to} échoué : ${error.message}`);
      throw new ServiceUnavailableException(`Envoi de l'email impossible : ${error.message}`);
    }
  }
}
