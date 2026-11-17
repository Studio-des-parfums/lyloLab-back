import { ForbiddenException } from '@nestjs/common';
import { FormulaCollaborationService } from './formula-collaboration.service.js';

const user = { id: 'u1', name: 'Dwain', email: 'd@x.fr', role: 'member' as const, teamId: 't1' };

function setup(formula: { id: string; rootFormulaId: string | null } | null = { id: 'v2', rootFormulaId: 'v1' }) {
  const tx = {
    formula: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 2 })) },
    formulationRequest: {
      findFirst: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'r1' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    formulaMessage: { create: vi.fn(async ({ data }) => ({ id: 'm1', ...data })) },
    notification: { createMany: vi.fn(async () => ({ count: 0 })) },
  };
  const prisma = {
    formula: {
      findFirst: vi.fn(async () => (formula ? { ...formula, name: 'Soleil', version: 2 } : null)),
      updateMany: vi.fn(async () => ({ count: 2 })),
      update: vi.fn(async () => ({})),
      findUniqueOrThrow: vi.fn(async () => ({
        name: 'Soleil', code: 'SOL', version: 2, description: 'Un floral solaire',
        project: { name: 'Été', client: { company: 'Maison X', contactFirstName: null, contactLastName: null } },
      })),
    },
    formulaNote: {
      findFirst: vi.fn(async () => ({ id: 'n1', authorId: 'u2' })),
      delete: vi.fn(async () => ({})),
    },
    formulationRequest: {
      findUnique: vi.fn(async () => ({
        id: 'r1', apiKeyId: 'k1', externalRef: null, status: 'completed', perfumeName: null, description: 'x',
        requesterName: 'Ext', requesterEmail: 'e@x.fr', forClient: false, clientCompany: null,
        clientFirstName: null, clientLastName: null, projectName: null, createdAt: new Date(),
        updatedAt: new Date(), assignedAt: null, completedAt: new Date(), assignedTo: null, completedBy: null,
      })),
    },
    user: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => id !== 'outsider').map((id) => ({ id, name: `User ${id}`, email: `${id}@x.fr` })),
      ),
    },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: typeof tx) => Promise<unknown>)(tx) : Promise.all(arg as unknown[]),
    ),
  };
  const webhooks = { notify: vi.fn() };
  const requesterMail = { notify: vi.fn() };
  const mail = { configured: true, send: vi.fn(async (_m: { to: string; subject: string; text: string }) => {}) };
  return { service: new FormulaCollaborationService(prisma as never, webhooks as never, mail as never, requesterMail as never), prisma, tx, webhooks, mail, requesterMail };
}

describe('FormulaCollaborationService', () => {
  it('completes the linked in-progress request and notifies its platform when a version is marked final', async () => {
    const { service, tx, webhooks, requesterMail } = setup();
    await service.markFinal(user, 'v2');
    expect(tx.formulationRequest.findFirst.mock.calls[0][0].where).toEqual({ teamId: 't1', formulaId: 'v1', status: 'in_progress' });
    expect(tx.formulationRequest.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'completed', completedById: 'u1' });
    expect(webhooks.notify).toHaveBeenCalledWith('k1', 'formulation_request.completed', expect.objectContaining({ id: 'r1' }));
    expect(requesterMail.notify).toHaveBeenCalledWith('completed', expect.objectContaining({ id: 'r1' }));
  });

  it('sends no webhook when the formula has no in-progress request', async () => {
    const { service, tx, webhooks } = setup();
    tx.formulationRequest.findFirst.mockResolvedValueOnce(null);
    await service.markFinal(user, 'v2');
    expect(tx.formulationRequest.updateMany).not.toHaveBeenCalled();
    expect(webhooks.notify).not.toHaveBeenCalled();
  });

  it('updates the description on the whole lineage', async () => {
    const { service, prisma } = setup();
    await service.updateDescription(user, 'v2', '  Un ambré solaire  ');
    expect(prisma.formula.updateMany).toHaveBeenCalledWith({
      where: { teamId: 't1', OR: [{ id: 'v1' }, { rootFormulaId: 'v1' }] },
      data: { description: 'Un ambré solaire' },
    });
  });

  it('attaches messages to the lineage root and notifies mentioned members only', async () => {
    const { service, prisma, tx } = setup();
    await service.postMessage(user, 'v2', '@Castor avis ?', ['u2', 'u1', 'outsider', 'u2']);
    // Soi-même et les doublons sont retirés avant la vérification d'appartenance à l'équipe.
    expect(prisma.user.findMany.mock.calls[0][0].where.id.in).toEqual(['u2', 'outsider']);
    expect(tx.formulaMessage.create.mock.calls[0][0].data).toMatchObject({ rootFormulaId: 'v1', mentions: ['u2'] });
    expect(tx.notification.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ userId: 'u2', type: 'mention', formulaId: 'v2', actorName: 'Dwain' }),
    ]);
  });

  it('creates no notification without mentions', async () => {
    const { service, tx, mail } = setup();
    await service.postMessage(user, 'v2', 'Juste une remarque');
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('emails every mentioned member with the formula, the author and the message', async () => {
    const { service, mail } = setup();
    await service.postMessage(user, 'v2', '@Castor @Pollux avis ?', ['u2', 'u3']);
    await vi.waitFor(() => expect(mail.send).toHaveBeenCalledTimes(2));
    const sent = mail.send.mock.calls.map((c) => c[0]);
    expect(sent.map((m) => m.to)).toEqual(['u2@x.fr', 'u3@x.fr']);
    expect(sent[0].subject).toBe('Dwain vous a mentionné sur Soleil');
    expect(sent[0].text).toContain('> @Castor @Pollux avis ?');
    expect(sent[0].text).toContain('Soleil (SOL) · v2');
    expect(sent[0].text).toContain('Client : Maison X');
  });

  it('still posts the message when an email fails', async () => {
    const { service, mail } = setup();
    mail.send.mockRejectedValue(new Error('down'));
    await expect(service.postMessage(user, 'v2', '@Castor', ['u2'])).resolves.toMatchObject({ id: 'm1' });
  });

  it("refuses to delete someone else's note unless admin", async () => {
    const { service, prisma } = setup();
    await expect(service.deleteNote(user, 'v2', 'n1')).rejects.toBeInstanceOf(ForbiddenException);
    await service.deleteNote({ ...user, role: 'admin' }, 'v2', 'n1');
    expect(prisma.formulaNote.delete).toHaveBeenCalled();
  });

  it('marks a version as final: locks it and records it on the whole lineage', async () => {
    const { service, tx } = setup();
    await service.markFinal(user, 'v2');
    expect(tx.formula.update).toHaveBeenCalledWith({ where: { id: 'v2' }, data: { status: 'completed' } });
    expect(tx.formula.updateMany).toHaveBeenCalledWith({
      where: { teamId: 't1', OR: [{ id: 'v1' }, { rootFormulaId: 'v1' }] },
      data: { finalVersionId: 'v2' },
    });
  });
});
