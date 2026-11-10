import { describe, expect, it } from 'vitest';
import { searchCatalog } from './catalog-tool.js';

const catalog = [
  { name: 'Vanilline', family: 'Gourmand', sensation: 'vanille sucrée', descriptors: { Gourmand: 9, Poudré: 5 } },
  { name: 'Bergamote', family: 'Hespéridé', sensation: 'agrume frais', descriptors: { Fraicheur: 8, Acidulé: 6 } },
  { name: 'Iso E Super', family: 'Boisé', sensation: 'bois velouté', descriptors: { Boisé: 7, Poudré: 2 } },
];

describe('searchCatalog', () => {
  it('returns everything without filters', () => {
    expect(searchCatalog(catalog, { facettes: null, mots_cles: null }, 4)).toHaveLength(3);
  });
  it('filters by salient facet', () => {
    expect(searchCatalog(catalog, { facettes: ['Poudré'], mots_cles: null }, 4).map((m) => m.name)).toEqual(['Vanilline']);
  });
  it('matches keywords without accents', () => {
    expect(searchCatalog(catalog, { facettes: null, mots_cles: ['hesperide'] }, 4).map((m) => m.name)).toEqual(['Bergamote']);
  });
});
