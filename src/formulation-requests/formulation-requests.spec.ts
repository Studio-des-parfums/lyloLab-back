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
    return { service: new FormulationRequestsService(prisma as never), prisma };
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
