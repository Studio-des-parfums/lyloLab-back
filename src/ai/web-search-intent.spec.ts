import { describe, expect, it } from 'vitest';
import { needsWebSearch } from './web-search-intent.js';

describe('needsWebSearch', () => {
  it.each([
    'Je veux un parfum qui ressemble à Sauvage',
    "Fais-moi quelque chose dans l'esprit de Baccarat Rouge 540",
    'Une formule inspirée de Chanel N°5',
    'Quelle est la pyramide olfactive de Shalimar ?',
    'Comme le parfum de Le Labo Santal 33',
    'Quelles sont les tendances parfum de cet hiver ?',
    'Cherche sur internet un accord cola',
    'Un truc façon Terre d’Hermès',
  ])('searches for "%s"', (message) => {
    expect(needsWebSearch(message)).toBe(true);
  });

  it.each([
    'Ajoute un peu de vanille',
    'Rends la formule plus fraîche',
    'Pourquoi la bergamote est plafonnée ?',
    "Propose une formule qui évoque l'été",
    'Monte la tenue à 70',
    'Retire le patchouli et rééquilibre les pourcentages',
  ])('does not search for "%s"', (message) => {
    expect(needsWebSearch(message)).toBe(false);
  });
});
