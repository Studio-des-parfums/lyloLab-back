import { describe, expect, it } from 'vitest';
import {
  EU_ALLERGENS_26,
  EU_ALLERGENS_EXTENDED,
  RULES,
  applyRule,
  normalizeSubstance,
  type RuleContext,
} from './regulation-rules.js';

const list = (names: string[], cas: string[] = []) => ({
  names: new Set(names.map(normalizeSubstance)),
  cas: new Set(cas),
});
const ctx: RuleContext = {
  substances: new Map([
    [
      EU_ALLERGENS_26,
      list(['Limonene', 'Linalool', 'Oakmoss extract'], ['78-70-6']),
    ],
    [
      EU_ALLERGENS_EXTENDED,
      list(['Camphor', 'Beta-Caryophyllene', 'Caryophyllene'], ['121-33-5']),
    ],
  ]),
};
const material = (
  regulatory: object,
  flavorRestriction: string | null = null,
  casNumber?: string,
) => ({
  id: 'm',
  casNumber,
  regulatory,
  flavorRestriction,
});

describe('regulation rules', () => {
  it('reads IFRA limits and bans', () => {
    expect(
      applyRule(
        'ifra-cat4',
        material({ ifraLimit: '1,6 %', ifraAmendment: '51' }),
        ctx,
      ),
    ).toEqual({
      status: 'Max 1.6 %',
      maxPercent: 1.6,
      detail: 'Amendement 51',
    });
    expect(
      applyRule('ifra-cat4', material({ ifraLimit: 'Interdite' }), ctx)
        ?.maxPercent,
    ).toBe(0);
    expect(
      applyRule('ifra-cat4', material({ ifraLimit: 'Aucune limite' }), ctx),
    ).toBeNull();
  });

  it('classifies EU allergens with the official lists', () => {
    const mixed = material({ allergens: ['Limonene', 'Camphor'] });
    const onlyNew = material({ allergens: ['β-caryophyllène'] });
    expect(applyRule(EU_ALLERGENS_26, mixed, ctx)?.status).toBe('Limonene');
    expect(applyRule(EU_ALLERGENS_EXTENDED, mixed, ctx)).toMatchObject({
      status: 'Camphor',
      detail: expect.stringContaining('Déjà déclarable'),
    });
    expect(applyRule(EU_ALLERGENS_EXTENDED, onlyNew, ctx)?.detail).toContain(
      'Nouvellement',
    );
    expect(
      applyRule(
        EU_ALLERGENS_26,
        material({ allergens: ['oakmoss  EXTRACT'] }),
        ctx,
      ),
    ).not.toBeNull();
  });

  it('links a material that is itself an allergen through its CAS number', () => {
    expect(
      applyRule(EU_ALLERGENS_26, material({}, null, '78-70-6'), ctx),
    ).not.toBeNull();
    expect(
      applyRule(EU_ALLERGENS_EXTENDED, material({}, null, '121-33-5'), ctx),
    ).not.toBeNull();
    expect(
      applyRule(EU_ALLERGENS_EXTENDED, material({}, null, '1-1-1'), ctx),
    ).toBeNull();
  });

  it('flags declared allergens that are in no EU list', () => {
    const hit = applyRule(
      'to-check',
      material({ allergens: ['Cedryl acetate', 'Limonene'] }),
      ctx,
    );
    expect(hit?.status).toBe('allergènes hors liste UE');
    expect(hit?.detail).toContain('Cedryl acetate');
    expect(hit?.detail).not.toContain('Limonene');
  });

  it('ignores allowed regional statuses and groups pending checks', () => {
    expect(
      applyRule('usa-mocra', material({ usaMocra: 'Autorisé' }), ctx),
    ).toBeNull();
    expect(
      applyRule('china-csar', material({ chinaCsar: 'Interdit' }), ctx)
        ?.maxPercent,
    ).toBe(0);
    expect(
      applyRule(
        'to-check',
        material({ menaGso: 'À vérifier', usaMocra: 'À vérifier' }),
        ctx,
      )?.status,
    ).toBe('USA, MENA');
  });

  it('uses the inventory flavour restriction column', () => {
    expect(
      applyRule('eu-flavourings', material({}, 'Risque estragol'), ctx)?.status,
    ).toBe('Risque estragol');
  });

  it('applies generic substance lists (declare or ban)', () => {
    const listCtx: RuleContext = {
      substances: new Map([
        ['canada', list(['Limonene'], ['78-70-6'])],
        [
          'ban',
          list(
            ['Trimethylbenzoyl Diphenylphosphine Oxide', 'TPO'],
            ['75980-60-8'],
          ),
        ],
      ]),
      substanceRules: new Map([
        ['canada', 'declare'],
        ['ban', 'ban'],
      ]),
    };
    expect(
      applyRule('canada', material({ allergens: ['Limonene'] }), listCtx)
        ?.status,
    ).toBe('Limonene');
    expect(
      applyRule('canada', material({}, null, '78-70-6'), listCtx)?.status,
    ).toBe('la matière elle-même');
    expect(
      applyRule('ban', { id: 'x', name: 'TPO', regulatory: {} }, listCtx),
    ).toMatchObject({
      status: 'Interdite',
      maxPercent: 0,
    });
    expect(
      applyRule('ban', material({ allergens: ['Limonene'] }), listCtx),
    ).toBeNull();
    // No list and no dedicated rule (e.g. IFRA 52 not published yet): no link.
    expect(
      applyRule('ifra-52', material({ ifraLimit: '1 %' }), listCtx),
    ).toBeNull();
  });

  it('returns null for an unknown code', () => {
    expect(
      applyRule('unknown', material({ ifraLimit: '1 %' }), ctx),
    ).toBeNull();
    expect(Object.keys(RULES)).toHaveLength(12);
  });
});
