import { describe, expect, it } from 'vitest';
import { describeContext } from './ai.service.js';

describe('describeContext', () => {
  it('returns null when there is nothing to tell', () => {
    expect(describeContext({ description: null, project: null, notes: [] })).toBeNull();
  });

  it('includes project, target result and notes', () => {
    const text = describeContext({
      description: 'Un ambré lumineux',
      project: { name: 'Collection hiver', description: 'Ambre chaud, vanille, bergamote', client: 'Maison X' },
      notes: [{ version: 2, author: 'Léa', createdAt: new Date('2026-11-10'), body: 'Trop\nsucré' }],
    })!;
    expect(text).toContain('Projet : Collection hiver (client : Maison X)');
    expect(text).toContain('Ambre chaud, vanille, bergamote');
    expect(text).toContain('Résultat visé pour cette formule : Un ambré lumineux');
    expect(text).toContain('v2, Léa, 2026-11-10 : Trop sucré');
  });

  it('includes the team conversation in order', () => {
    const text = describeContext({
      description: null,
      project: null,
      notes: [],
      messages: [
        { author: 'Léa', createdAt: new Date('2026-11-10T09:00:00Z'), body: 'Le client veut moins de vanille' },
        { author: 'Tom', createdAt: new Date('2026-11-11T14:30:00Z'), body: 'OK, on garde la bergamote' },
      ],
    })!;
    expect(text).toContain('Conversation de l\'équipe');
    expect(text.indexOf('moins de vanille')).toBeLessThan(text.indexOf('garde la bergamote'));
    expect(text).toContain('2026-11-11 14:30 Tom : OK, on garde la bergamote');
  });
});
