import { Injectable, Logger } from '@nestjs/common';
import { MailService, type MailMessage } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Étapes de la vie d'une demande qui déclenchent un mail au demandeur. */
export type RequestMailEvent = 'received' | 'taken' | 'started' | 'completed' | 'cancelled';

export interface RequestMailData {
  requesterName: string;
  requesterEmail: string;
  perfumeName: string | null;
  projectName: string | null;
  description: string;
  externalRef: string | null;
  assignedTo?: { name: string } | null;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const STATUS_LABEL: Record<RequestMailEvent, string> = {
  received: 'Reçue',
  taken: 'Prise en charge',
  started: 'Formulation commencée',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

function intro(event: RequestMailEvent, team: string, who: string | null) {
  switch (event) {
    case 'received':
      return `Votre demande de formulation a bien été reçue par ${team}. Vous serez prévenu(e) à chaque étape.`;
    case 'taken':
      return `Votre demande a été prise en charge${who ? ` par ${who}` : ''} chez ${team}.`;
    case 'started':
      return `${who ?? 'Le parfumeur'} a commencé à travailler sur votre formule.`;
    case 'completed':
      return `Bonne nouvelle : votre formule est terminée${who ? `, finalisée par ${who}` : ''}.`;
    case 'cancelled':
      return 'Votre demande de formulation a été annulée.';
  }
}

/** Compose le mail envoyé au demandeur pour une étape donnée. */
export function composeRequestMail(event: RequestMailEvent, r: RequestMailData, teamName: string): MailMessage {
  const title = r.perfumeName || r.projectName || 'votre demande';
  const who = r.assignedTo?.name ?? null;
  const details: [string, string][] = [
    ['Statut', STATUS_LABEL[event]],
    ...(r.perfumeName ? [['Parfum', r.perfumeName] as [string, string]] : []),
    ...(r.projectName ? [['Projet', r.projectName] as [string, string]] : []),
    ...(r.externalRef ? [['Référence', r.externalRef] as [string, string]] : []),
    ['Demande', r.description],
  ];
  const message = intro(event, teamName, who);

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#2b2a28">
<p>Bonjour ${escapeHtml(r.requesterName)},</p>
<p>${escapeHtml(message)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:20px">
${details
  .map(
    ([label, value]) => `<tr>
  <td style="padding:6px 10px 6px 0;color:#8a8373;white-space:nowrap;vertical-align:top">${label}</td>
  <td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(value)}</td>
</tr>`,
  )
  .join('\n')}
</table>
<p style="margin-top:28px;color:#a9a291;font-size:12px">Vous recevez ce mail car vous avez fait une demande de formulation auprès de ${escapeHtml(teamName)}.</p>
</div>`;

  const text = [
    `Bonjour ${r.requesterName},`,
    '',
    message,
    '',
    ...details.map(([label, value]) => `${label} : ${value}`),
  ].join('\n');

  return {
    to: r.requesterEmail,
    subject: `${STATUS_LABEL[event]} · ${title}`,
    html,
    text,
  };
}

/** Prévient le demandeur externe à chaque changement de statut de sa demande. */
@Injectable()
export class RequesterMailService {
  private readonly logger = new Logger(RequesterMailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Sans attendre ni lever : un mail raté ne doit jamais faire échouer le changement de statut. */
  notify(event: RequestMailEvent, request: RequestMailData & { teamId: string }) {
    if (!this.mail.configured) return;
    void (async () => {
      try {
        const team = await this.prisma.team.findUnique({ where: { id: request.teamId }, select: { name: true } });
        await this.mail.send(composeRequestMail(event, request, team?.name ?? 'Lylo Lab'));
      } catch (err) {
        this.logger.error(`Mail « ${event} » non envoyé à ${request.requesterEmail}`, err as Error);
      }
    })();
  }
}
