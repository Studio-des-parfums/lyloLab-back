import { describe, expect, it } from 'vitest';
import { COUNTRIES, parseOrigins } from './countries.js';

describe('parseOrigins', () => {
  it('normalizes spellings, typos and regions', () => {
    expect(parseOrigins('Indonesia').places).toEqual(['Indonésie']);
    expect(parseOrigins('Espange, Tunisie, Maroc').places).toEqual([
      'Espagne',
      'Tunisie',
      'Maroc',
    ]);
    expect(parseOrigins('Colombia/Venezuela').places).toEqual([
      'Colombie',
      'Venezuela',
    ]);
    expect(parseOrigins('Haute provence').places).toEqual(['France']);
    expect(parseOrigins('Balkans, Maroc').places).toEqual(['Balkans', 'Maroc']);
    expect(parseOrigins("Cote d'ivoire").places).toEqual(["Côte d'Ivoire"]);
  });

  it('ignores empty markers and reports unknown places', () => {
    expect(parseOrigins('-')).toEqual({ places: [], unknown: [] });
    expect(parseOrigins('?').places).toEqual([]);
    expect(parseOrigins('Atlantide')).toEqual({
      places: [],
      unknown: ['Atlantide'],
    });
  });

  it('has unique names and ISO codes', () => {
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(COUNTRIES.length);
    const codes = COUNTRIES.flatMap((c) =>
      c.isoNumeric ? [c.isoNumeric] : [],
    );
    expect(new Set(codes).size).toBe(codes.length);
  });
});
