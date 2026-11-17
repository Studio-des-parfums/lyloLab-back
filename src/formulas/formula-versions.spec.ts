import { NotFoundException } from '@nestjs/common';
import { FormulasService } from './formulas.service.js';

const user = { id: 'u1', name: 'Polux', email: 'p@x.fr', role: 'member' as const, teamId: 't1' };
const dto = { name: 'Soleil', facets: {}, adjustments: {}, lines: [] };

function setup(formulas: Record<string, { id: string; rootFormulaId: string | null; projectId: string | null; version: number; code?: string | null; finalVersionId?: string | null }>) {
  const tx = {
    formula: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => formulas[where.id] ?? null),
      aggregate: vi.fn(async ({ where }: { where: { OR: [{ id: string }, { rootFormulaId: string }] } }) => {
        const root = where.OR[0].id;
        const versions = Object.values(formulas).filter((f) => f.id === root || f.rootFormulaId === root).map((f) => f.version);
        return { _max: { version: versions.length ? Math.max(...versions) : null } };
      }),
      create: vi.fn(async ({ data }) => data),
      findMany: vi.fn(async (args?: { select?: { code?: boolean } }) =>
        args?.select?.code ? Object.values(formulas).map((f) => ({ code: f.code ?? null })) : ([] as { id: string }[]),
      ),
      count: vi.fn(async () => 0),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
      delete: vi.fn(async () => ({})),
    },
    formulationRequest: { updateMany: vi.fn(async () => ({ count: 0 })) },
    formulaMessage: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  const prisma = {
    material: { count: vi.fn(async () => 0) },
    project: { findFirst: vi.fn(async () => ({ id: 'p1' })) },
    formula: { findFirst: vi.fn(async ({ where }: { where: { id: string } }) => formulas[where.id] ?? null) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { service: new FormulasService(prisma as never, {} as never), tx };
}

describe('formula versions', () => {
  const lineage = {
    v1: { id: 'v1', rootFormulaId: null, projectId: 'p1', version: 1, finalVersionId: null, code: '123-345-1' },
    v2: { id: 'v2', rootFormulaId: 'v1', projectId: 'p1', version: 2, finalVersionId: null, code: '123-345-2' },
  };

  it('creates a v1 without versionOfId', async () => {
    const { service } = setup({});
    const created = (await service.create(user, dto)) as unknown as { version: number; rootFormulaId: null };
    expect(created).toMatchObject({ version: 1, rootFormulaId: null });
    expect((created as unknown as { code: string }).code).toMatch(/^\d{3}-\d{3}-1$/);
  });

  it('creates v2 from v1 and inherits the project', async () => {
    const { service } = setup({ v1: lineage.v1 });
    const created = (await service.create(user, { ...dto, versionOfId: 'v1' })) as unknown as Record<string, unknown>;
    expect(created).toMatchObject({ version: 2, rootFormulaId: 'v1', projectId: 'p1', code: '123-345-2' });
  });

  it('creates v3 from v2 under the same root', async () => {
    const { service } = setup(lineage);
    const created = (await service.create(user, { ...dto, versionOfId: 'v2' })) as unknown as Record<string, unknown>;
    expect(created).toMatchObject({ version: 3, rootFormulaId: 'v1', code: '123-345-3' });
  });

  it('numbers after the highest version even from an old one', async () => {
    const { service } = setup(lineage);
    const created = (await service.create(user, { ...dto, versionOfId: 'v1' })) as unknown as Record<string, unknown>;
    expect(created.version).toBe(3);
    // La v1 a déjà une suite (-2) : on ouvre une branche.
    expect(created.code).toBe('123-345-1-1');
  });

  it('rejects a source from another team', async () => {
    const { service } = setup({});
    await expect(service.create(user, { ...dto, versionOfId: 'other' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('promotes the oldest remaining version when v1 is deleted', async () => {
    const { service, tx } = setup(lineage);
    tx.formula.findMany.mockResolvedValueOnce([{ id: 'v2' }, { id: 'v3' }]);
    await service.remove('t1', 'v1');
    expect(tx.formula.update).toHaveBeenCalledWith({ where: { id: 'v2' }, data: { rootFormulaId: null } });
    expect(tx.formula.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['v3'] } }, data: { rootFormulaId: 'v2' } });
    expect(tx.formula.updateMany).toHaveBeenCalledWith({ where: { finalVersionId: 'v1' }, data: { finalVersionId: null } });
    expect(tx.formulationRequest.updateMany).toHaveBeenCalledWith({ where: { formulaId: 'v1' }, data: { formulaId: 'v2' } });
    expect(tx.formulaMessage.updateMany).toHaveBeenCalledWith({ where: { rootFormulaId: 'v1' }, data: { rootFormulaId: 'v2' } });
    expect(tx.formula.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });
});
