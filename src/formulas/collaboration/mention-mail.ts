import type { MailMessage } from '../../mail/mail.service.js';

export interface MentionMailFormula {
  name: string;
  code: string | null;
  version: number;
  description: string | null;
  project: {
    name: string;
    client: { company: string | null; contactFirstName: string | null; contactLastName: string | null } | null;
  } | null;
}

export interface MentionMailInput {
  recipient: { name: string; email: string };
  authorName: string;
  body: string;
  formula: MentionMailFormula;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

function clientLabel(client: NonNullable<MentionMailFormula['project']>['client']) {
  if (!client) return null;
  const contact = [client.contactFirstName, client.contactLastName].filter(Boolean).join(' ');
  return client.company || contact || null;
}

/** Mail envoyé à un membre mentionné dans la discussion d'une formule. */
export function composeMentionMail({ recipient, authorName, body, formula }: MentionMailInput): MailMessage {
  const title = `${formula.name}${formula.code ? ` (${formula.code})` : ''} · v${formula.version}`;
  const client = clientLabel(formula.project?.client ?? null);
  const details: [string, string][] = [
    ['Formule', title],
    ...(formula.project ? [['Projet', formula.project.name] as [string, string]] : []),
    ...(client ? [['Client', client] as [string, string]] : []),
    ...(formula.description ? [['Objectif', formula.description] as [string, string]] : []),
  ];
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#2b2a28">
<p>Bonjour ${escapeHtml(recipient.name)},</p>
<p><strong>${escapeHtml(authorName)}</strong> vous a mentionné dans la discussion de la formule <strong>${escapeHtml(formula.name)}</strong> :</p>
<blockquote style="margin:16px 0;padding:12px 16px;background:#f7f4ee;border-left:3px solid #8a7a55;border-radius:4px;white-space:pre-wrap">${escapeHtml(body)}</blockquote>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:20px">
${details
  .map(
    ([label, value]) => `<tr>
  <td style="padding:6px 10px 6px 0;color:#8a8373;white-space:nowrap;vertical-align:top">${label}</td>
  <td style="padding:6px 0">${escapeHtml(value)}</td>
</tr>`,
  )
  .join('\n')}
</table>
${appUrl ? `<p style="margin-top:28px"><a href="${escapeHtml(appUrl)}" style="background:#8a7a55;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Répondre dans Lylo Lab</a></p>` : ''}
<p style="margin-top:28px;color:#a9a291;font-size:12px">Vous recevez ce mail car un membre de votre équipe vous a mentionné.</p>
</div>`;

  const text = [
    `Bonjour ${recipient.name},`,
    '',
    `${authorName} vous a mentionné dans la discussion de la formule ${formula.name} :`,
    '',
    ...body.split('\n').map((l) => `> ${l}`),
    '',
    ...details.map(([label, value]) => `${label} : ${value}`),
    ...(appUrl ? ['', appUrl] : []),
  ].join('\n');

  return {
    to: recipient.email,
    subject: `${authorName} vous a mentionné sur ${formula.name}`,
    html,
    text,
  };
}
