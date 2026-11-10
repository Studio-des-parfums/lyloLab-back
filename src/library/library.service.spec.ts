import { describe, expect, it } from 'vitest';
import { dominantFacet } from './library.service.js';

describe('dominantFacet', () => {
  it('returns the facet with the highest score', () => {
    expect(dominantFacet({ Boisé: 7, Floral: 3, Ambré: 7.5 })).toBe('Ambré');
  });

  it('ignores unknown keys and empty profiles', () => {
    expect(dominantFacet({ Inconnu: 9, Vert: 2 })).toBe('Vert');
    expect(dominantFacet({})).toBeNull();
    expect(dominantFacet(null)).toBeNull();
    expect(dominantFacet({ Boisé: 0 })).toBeNull();
  });
});
