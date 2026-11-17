import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateFormulationRequestDto } from './dto/create-formulation-request.dto.js';
import { FormulationRequestsService } from './formulation-requests.service.js';

const errorsOf = async (body: object) =>
  (await validate(plainToInstance(CreateFormulationRequestDto, body))).map((e) => e.property);

describe('CreateFormulationRequestDto', () => {
  const base = { requesterName: 'Dwain', requesterEmail: 'd@example.com', description: 'Un boisé frais' };

  it('accepts a minimal request', async () => {
    expect(await errorsOf(base)).toEqual([]);
  });

  it('requires description, requester and a valid email', async () => {
    expect(await errorsOf({ requesterEmail: 'nope' })).toEqual(
      expect.arrayContaining(['requesterName', 'requesterEmail', 'description']),
    );
  });

  it('requires a company or last name when forClient is true', async () => {
    expect(await errorsOf({ ...base, forClient: true })).toContain('clientCompany');
    expect(await errorsOf({ ...base, forClient: true, clientLastName: 'Martin' })).toEqual([]);
    expect(await errorsOf({ ...base, forClient: true, clientCompany: 'ACME' })).toEqual([]);
  });
});

describe('FormulationRequestsService (API)', () => {
  const client = { apiKeyId: 'k1', teamId: 't1', name: 'Gestionnaire' };
  const row = {
    id: 'r1', externalRef: 'task-42', status: 'pending', perfumeName: null, description: 'x',
    requesterName: 'Dwain', requesterEmail: 'd@example.com', forClient: false,
    clientCompany: null, clientFirstName: null, clientLastName: null, projectName: null,
    createdAt: new Date(), updatedAt: new Date(), assignedAt: null, completedAt: null,
    assignedTo: null, completedBy: null,
  };

  function makeService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      formulationRequest: {
        create: vi.fn(async ({ data }) => ({ ...row, ...data })),
        findFirst: vi.fn(async () => row),
        updateMany: vi.fn(async () => ({ count: 1 })),
        ...overrides,
      },
    };
    return { service: new FormulationRequestsService(prisma as never, { notify: vi.fn() } as never, { notify: vi.fn() } as never), prisma };
  }

  it('drops client fields when the request is not for a client', async () => {
    const { service, prisma } = makeService();
    const result = await service.createFromApi(client, {
      requesterName: 'Dwain', requesterEmail: 'd@example.com', description: 'x', clientCompany: 'ACME',
    });
    expect(prisma.formulationRequest.create.mock.calls[0][0].data).toMatchObject({
      teamId: 't1', apiKeyId: 'k1', forClient: false, clientCompany: null,
    });
    expect(result.client).toBeNull();
  });

  it('returns 404 for a request of another key', async () => {
    const { service } = makeService({ findFirst: vi.fn(async () => null) });
    await expect(service.findOneForApi(client, 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to cancel a request that is no longer pending', async () => {
    const { service } = makeService({ updateMany: vi.fn(async () => ({ count: 0 })) });
    await expect(service.cancelFromApi(client, 'r1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('FormulationRequestsService.take', () => {
  const user = { id: 'u1', name: 'Polux', email: 'p@x.fr', role: 'member' as const, teamId: 't1' };
  const base = {
    id: 'r1', teamId: 't1', status: 'pending', forClient: true, perfumeName: 'Soleil', projectName: 'Hiver',
    description: 'desc', clientCompany: 'ACME', clientEmail: 'c@acme.fr', clientFirstName: null,
    clientLastName: null, clientPhone: null, assignedTo: null,
  };

  function setup(request: Record<string, unknown>, opts: { reserved?: number; existingClient?: { id: string } | null } = {}) {
    const tx = {
      formulationRequest: {
        updateMany: vi.fn(async () => ({ count: opts.reserved ?? 1 })),
        update: vi.fn(async () => ({})),
      },
      client: {
        findFirst: vi.fn(async () => opts.existingClient ?? null),
        create: vi.fn(async () => ({ id: 'c-new' })),
      },
      project: { upsert: vi.fn(async () => ({ id: 'p1' })) },
      formula: { create: vi.fn(async () => ({ id: 'f1' })) },
    };
    const prisma = {
      formulationRequest: { findFirst: vi.fn(async () => request) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    return { service: new FormulationRequestsService(prisma as never, { notify: vi.fn() } as never, { notify: vi.fn() } as never), tx };
  }

  it('creates client, project and draft formula, and assigns the user', async () => {
    const { service, tx } = setup(base);
    await service.take(user, 'r1');
    expect(tx.formulationRequest.updateMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'pending' },
      data: { status: 'in_progress', assignedToId: 'u1' },
    });
    expect(tx.client.create).toHaveBeenCalled();
    expect(tx.project.upsert.mock.calls[0][0].create).toMatchObject({ clientId: 'c-new', name: 'Hiver' });
    expect(tx.formula.create.mock.calls[0][0].data).toMatchObject({ projectId: 'p1', status: 'draft', name: 'Soleil' });
    expect(tx.formulationRequest.update.mock.calls[0][0].data).toEqual({ clientId: 'c-new', projectId: 'p1', formulaId: 'f1' });
  });

  it('reuses an existing client', async () => {
    const { service, tx } = setup(base, { existingClient: { id: 'c-old' } });
    await service.take(user, 'r1');
    expect(tx.client.create).not.toHaveBeenCalled();
    expect(tx.project.upsert.mock.calls[0][0].create.clientId).toBe('c-old');
  });

  it('creates only a formula when the request is not for a client', async () => {
    const { service, tx } = setup({ ...base, forClient: false });
    await service.take(user, 'r1');
    expect(tx.client.findFirst).not.toHaveBeenCalled();
    expect(tx.project.upsert).not.toHaveBeenCalled();
    expect(tx.formula.create.mock.calls[0][0].data.projectId).toBeNull();
  });

  it('returns 409 with the assignee name when already taken', async () => {
    const { service } = setup({ ...base, status: 'in_progress', assignedTo: { name: 'Castor' } });
    await expect(service.take(user, 'r1')).rejects.toThrow(/Castor/);
  });

  it('returns 409 when another user wins the race', async () => {
    const { service, tx } = setup(base, { reserved: 0 });
    await expect(service.take(user, 'r1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.formula.create).not.toHaveBeenCalled();
  });
});

describe('FormulationRequestsService.start', () => {
  const user = { id: 'u1', name: 'Polux', email: 'p@x.fr', role: 'member' as const, teamId: 't1' };
  const make = (request: Record<string, unknown>) => {
    const prisma = {
      formulationRequest: { findFirst: vi.fn(async () => request), update: vi.fn(async () => ({})) },
    };
    return { service: new FormulationRequestsService(prisma as never, { notify: vi.fn() } as never, { notify: vi.fn() } as never), prisma };
  };

  it('marks the request as started for its assignee', async () => {
    const { service, prisma } = make({ id: 'r1', assignedToId: 'u1', status: 'in_progress', startedAt: null });
    await service.start(user, 'r1');
    expect(prisma.formulationRequest.update.mock.calls[0][0].data.startedAt).toBeInstanceOf(Date);
  });

  it('refuses another user', async () => {
    const { service } = make({ id: 'r1', assignedToId: 'u2', status: 'in_progress', startedAt: null });
    await expect(service.start(user, 'r1')).rejects.toThrow(/personne qui s'occupe/);
  });
});
