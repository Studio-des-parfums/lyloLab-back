import { nextFormulaCode, randomFormulaPrefix } from './formula-code.js';

describe('formula codes', () => {
  it('generates a XXX-XXX prefix', () => {
    expect(randomFormulaPrefix()).toMatch(/^\d{3}-\d{3}$/);
  });

  it('continues the line when the next number is free', () => {
    expect(nextFormulaCode('123-345-1', new Set(['123-345-1']))).toBe('123-345-2');
    expect(nextFormulaCode('123-345-2-1', new Set(['123-345-1', '123-345-2', '123-345-2-1']))).toBe('123-345-2-2');
  });

  it('opens a branch when the version already has a follow-up', () => {
    const existing = new Set(['123-345-1', '123-345-2', '123-345-3']);
    expect(nextFormulaCode('123-345-2', existing)).toBe('123-345-2-1');
    existing.add('123-345-2-1');
    expect(nextFormulaCode('123-345-2', existing)).toBe('123-345-2-2');
    expect(nextFormulaCode('123-345-1', existing)).toBe('123-345-1-1');
  });
});
