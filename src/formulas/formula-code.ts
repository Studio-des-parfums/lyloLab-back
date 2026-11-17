import { randomInt } from 'node:crypto';

/** Préfixe aléatoire d'une nouvelle formule : « 123-456 ». */
export function randomFormulaPrefix(): string {
  const part = () => String(randomInt(0, 1000)).padStart(3, '0');
  return `${part()}-${part()}`;
}

/**
 * Identifiant de la version créée à partir de `sourceCode`.
 * - Suite : on incrémente le dernier numéro (123-456-2 → 123-456-3) s'il est libre.
 * - Sinon, la source a déjà une suite : on ouvre une branche (123-456-2-1, puis -2-2…).
 */
export function nextFormulaCode(sourceCode: string, existing: Set<string>): string {
  const segments = sourceCode.split('-');
  const last = Number(segments[segments.length - 1]);
  const continuation = [...segments.slice(0, -1), String(last + 1)].join('-');
  if (!existing.has(continuation)) return continuation;
  for (let n = 1; ; n++) {
    const branch = `${sourceCode}-${n}`;
    if (!existing.has(branch)) return branch;
  }
}
