import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  STABILITY_BASES,
  STABILITY_CONDITIONS,
  checkpointsOf,
} from './stability-knowledge.js';

const TIME_ZONE = 'Europe/Paris';
const DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of today in Paris. */
const parisToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());

const frDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

export interface ReminderItem {
  testId: string;
  formula: string;
  condition: string;
  base: string;
  day: number;
  dueDate: string;
  /** Days late, 0 for today. */
  late: number;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
}

/**
 * Every morning, one email per person listing all the checkpoints due today
 * or overdue on the tests they follow (creator + chosen team members).
 */
@Injectable()
export class StabilityRemindersService {
  private readonly logger = new Logger(StabilityRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Cron('0 8 * * *', { timeZone: TIME_ZONE, name: 'stability-reminders' })
  async sendDaily() {
    if (!this.mail.configured) {
      this.logger.warn('Rappels de stabilité non envoyés : email non configuré.');
      return;
    }
    const today = parisToday();
    const byUser = await this.collect(today);
    let sent = 0;
    for (const { user, items } of byUser.values()) {
      // Claims the (user, day) slot first: a second instance or a restart
      // hits the unique constraint and skips.
      try {
        await this.prisma.stabilityDigestLog.create({
          data: { userId: user.id, date: new Date(today), items: items.length },
        });
      } catch {
        continue;
      }
      try {
        await this.mail.send(this.compose(user, items, today));
        sent++;
      } catch (err) {
        // Frees the slot so a manual re-run can retry.
        await this.prisma.stabilityDigestLog.deleteMany({
          where: { userId: user.id, date: new Date(today) },
        });
        this.logger.error(`Rappel non envoyé à ${user.email}`, err as Error);
      }
    }
    this.logger.log(`Rappels de stabilité : ${sent}/${byUser.size} email(s) envoyé(s).`);
    return { recipients: byUser.size, sent };
  }

  /** Sends the current user's reminder right now (test button). */
  async sendPreview(userId: string) {
    const today = parisToday();
    const entry = (await this.collect(today)).get(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    const items = entry?.items ?? [];
    await this.mail.send(this.compose(user, items, today));
    return { email: user.email, items: items.length };
  }

  /** Due or overdue checkpoints of the running tests, grouped by recipient. */
  async collect(today: string) {
    const tests = await this.prisma.stabilityTest.findMany({
      where: { status: 'in_progress' },
      include: {
        formula: { select: { name: true } },
        observations: { select: { day: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        watchers: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    // Tests created before createdById existed: find the creator by name.
    const legacyNames = await this.prisma.user.findMany({
      where: {
        teamId: { in: [...new Set(tests.filter((t) => !t.createdById).map((t) => t.teamId))] },
      },
      select: { id: true, name: true, email: true, teamId: true },
    });

    const byUser = new Map<string, { user: Recipient; items: ReminderItem[] }>();
    const todayTime = new Date(today).getTime();
    for (const t of tests) {
      const due = checkpointsOf(
        t.startDate,
        t.checkpoints,
        t.observations.map((o) => o.day),
      ).filter((c) => !c.done && c.dueDate.toISOString().slice(0, 10) <= today);
      if (!due.length) continue;

      const creator =
        t.createdBy ??
        legacyNames.find((u) => u.teamId === t.teamId && u.name === t.createdByName) ??
        null;
      const recipients = [creator, ...t.watchers.map((w) => w.user)].filter(
        (u): u is Recipient => !!u,
      );
      const condition =
        STABILITY_CONDITIONS.find((c) => c.code === t.condition)?.label ?? t.condition;
      for (const user of recipients) {
        const entry = byUser.get(user.id) ?? { user, items: [] };
        byUser.set(user.id, entry);
        for (const c of due) {
          if (entry.items.some((i) => i.testId === t.id && i.day === c.day)) continue;
          const dueDate = c.dueDate.toISOString().slice(0, 10);
          entry.items.push({
            testId: t.id,
            formula: t.formula.name,
            condition:
              t.condition === 'other' && t.conditionLabel
                ? t.conditionLabel
                : t.conditionLabel
                  ? `${condition} (${t.conditionLabel})`
                  : condition,
            base: STABILITY_BASES.find((b) => b.code === t.base)?.label ?? t.base,
            day: c.day,
            dueDate,
            late: Math.round((todayTime - new Date(dueDate).getTime()) / DAY),
          });
        }
      }
    }
    for (const entry of byUser.values()) {
      entry.items.sort(
        (a, b) =>
          a.formula.localeCompare(b.formula) ||
          a.dueDate.localeCompare(b.dueDate) ||
          a.condition.localeCompare(b.condition),
      );
    }
    return byUser;
  }

  compose(user: Recipient, items: ReminderItem[], today: string) {
    const late = items.filter((i) => i.late > 0).length;
    const subject = items.length
      ? `Stabilité : ${items.length} contrôle${items.length > 1 ? 's' : ''} à faire${
          late ? ` dont ${late} en retard` : ''
        }`
      : 'Stabilité : aucun contrôle à faire aujourd’hui';
    const appUrl = process.env.APP_URL?.replace(/\/$/, '');
    const status = (i: ReminderItem) =>
      i.late > 0 ? `En retard de ${i.late} j` : "Aujourd'hui";

    const formulas = [...new Set(items.map((i) => i.formula))];
    const htmlGroups = formulas
      .map((f) => {
        const rows = items
          .filter((i) => i.formula === f)
          .map(
            (i) => `<tr>
  <td style="padding:8px 10px;border-top:1px solid #ece7dc">${escapeHtml(i.condition)}<br><span style="color:#8a8373;font-size:12px">${escapeHtml(i.base)}</span></td>
  <td style="padding:8px 10px;border-top:1px solid #ece7dc;white-space:nowrap"><strong>J+${i.day}</strong></td>
  <td style="padding:8px 10px;border-top:1px solid #ece7dc;white-space:nowrap">${frDate(i.dueDate)}</td>
  <td style="padding:8px 10px;border-top:1px solid #ece7dc;white-space:nowrap;color:${i.late > 0 ? '#b3261e' : '#8a6d1a'};font-weight:600">${status(i)}</td>
</tr>`,
          )
          .join('');
        return `<h3 style="margin:24px 0 8px;font-size:16px;color:#2b2a28">${escapeHtml(f)}</h3>
<table style="width:100%;border-collapse:collapse;font-size:14px;color:#2b2a28">
<tr style="color:#8a8373;font-size:12px;text-align:left"><th style="padding:4px 10px">Condition</th><th style="padding:4px 10px">Contrôle</th><th style="padding:4px 10px">Prévu le</th><th style="padding:4px 10px">Statut</th></tr>
${rows}</table>`;
      })
      .join('');

    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#2b2a28">
<p>Bonjour ${escapeHtml(user.name)},</p>
<p>${
      items.length
        ? `Voici les contrôles de stabilité à faire au ${frDate(today)} :`
        : `Aucun contrôle de stabilité n'est à faire au ${frDate(today)}.`
    }</p>
${htmlGroups}
${appUrl ? `<p style="margin-top:28px"><a href="${escapeHtml(appUrl)}" style="background:#8a7a55;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ouvrir Lylo Lab</a></p>` : ''}
<p style="margin-top:28px;color:#a9a291;font-size:12px">Vous recevez ce mail car vous suivez ces tests de stabilité. Un contrôle reste dans ce rappel jusqu'à sa saisie ou la fin du test.</p>
</div>`;

    const text = [
      `Bonjour ${user.name},`,
      '',
      items.length
        ? `Contrôles de stabilité à faire au ${frDate(today)} :`
        : `Aucun contrôle de stabilité à faire au ${frDate(today)}.`,
      ...formulas.flatMap((f) => [
        '',
        f,
        ...items
          .filter((i) => i.formula === f)
          .map((i) => `  - ${i.condition} · J+${i.day} · prévu le ${frDate(i.dueDate)} · ${status(i)}`),
      ]),
      ...(appUrl ? ['', appUrl] : []),
    ].join('\n');

    return { to: user.email, subject, html, text };
  }
}
