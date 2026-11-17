import { RequesterMailService, composeRequestMail } from './requester-mail.service.js';

const request = {
  teamId: 't1',
  requesterName: 'Alice',
  requesterEmail: 'alice@ext.fr',
  perfumeName: 'Soleil <b>',
  projectName: 'Été',
  description: 'Un floral solaire',
  externalRef: 'EXT-42',
  assignedTo: { name: 'Dwain' },
};

describe('composeRequestMail', () => {
  it('tells the requester who took the request, with its details', () => {
    const mail = composeRequestMail('taken', request, 'Maison Lylo');
    expect(mail.to).toBe('alice@ext.fr');
    expect(mail.subject).toBe('Prise en charge · Soleil <b>');
    expect(mail.text).toContain('prise en charge par Dwain chez Maison Lylo');
    expect(mail.text).toContain('Référence : EXT-42');
    expect(mail.html).toContain('Soleil &lt;b&gt;');
  });

  it('has a distinct subject for every status', () => {
    const subjects = (['received', 'taken', 'started', 'completed', 'cancelled'] as const).map(
      (e) => composeRequestMail(e, request, 'T').subject,
    );
    expect(new Set(subjects).size).toBe(5);
  });
});

describe('RequesterMailService', () => {
  it('never throws when sending fails', async () => {
    const prisma = { team: { findUnique: vi.fn(async () => ({ name: 'T' })) } };
    const mail = { configured: true, send: vi.fn(async () => { throw new Error('down'); }) };
    const service = new RequesterMailService(prisma as never, mail as never);
    expect(() => service.notify('received', request)).not.toThrow();
    await vi.waitFor(() => expect(mail.send).toHaveBeenCalled());
  });

  it('sends nothing when email is not configured', () => {
    const mail = { configured: false, send: vi.fn() };
    new RequesterMailService({} as never, mail as never).notify('received', request);
    expect(mail.send).not.toHaveBeenCalled();
  });
});
