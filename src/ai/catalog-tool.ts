import { FACETS } from './formula-changes.js';

/** Minimal shape needed to search the team's catalog. */
export interface SearchableMaterial {
  name: string;
  family: string | null;
  sensation: string | null;
  descriptors: unknown;
}

export const CATALOG_TOOL_NAME = 'consulter_catalogue';
const MAX_RESULTS = 40;

/**
 * Function tool letting the model fetch catalog materials only when it needs
 * them (to suggest or swap materials), instead of receiving the whole catalog
 * with every message.
 */
export const CATALOG_TOOL = {
  type: 'function' as const,
  name: CATALOG_TOOL_NAME,
  description:
    "Recherche des matières premières dans le catalogue de l'équipe (nom exact, famille, notes, odeur, limite IFRA, allergènes, stock). " +
    "À appeler seulement quand tu dois suggérer, ajouter ou remplacer des matières. Les matières déjà dans la formule sont décrites dans l'état de la formule. " +
    'Laisse les deux filtres à null pour obtenir tout le catalogue (à réserver à la création d\'une formule complète).',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      facettes: {
        type: ['array', 'null'],
        items: { type: 'string', enum: [...FACETS] },
        description: 'Matières dont au moins une de ces facettes est marquée, triées par intensité.',
      },
      mots_cles: {
        type: ['array', 'null'],
        items: { type: 'string' },
        description: 'Mots cherchés dans le nom, la famille ou la description d\'odeur (ex. "vanille", "agrume", "musc").',
      },
    },
    required: ['facettes', 'mots_cles'],
    additionalProperties: false,
  },
};

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Returns the materials matching the tool arguments, best matches first. */
export function searchCatalog<T extends SearchableMaterial>(
  catalog: T[],
  args: { facettes?: string[] | null; mots_cles?: string[] | null },
  salientMin: number,
): T[] {
  const facets = args.facettes?.filter(Boolean) ?? [];
  const keywords = (args.mots_cles ?? []).map(normalize).filter(Boolean);
  if (facets.length === 0 && keywords.length === 0) return catalog;

  const scored = catalog
    .map((material) => {
      const descriptors = (material.descriptors ?? {}) as Record<string, number>;
      const facetScore = facets.reduce(
        (sum, f) => sum + ((descriptors[f] ?? 0) >= salientMin ? descriptors[f] : 0),
        0,
      );
      const haystack = normalize(
        [material.name, material.family ?? '', material.sensation ?? ''].join(' '),
      );
      const keywordScore = keywords.filter((k) => haystack.includes(k)).length * 10;
      return { material, score: facetScore + keywordScore };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_RESULTS).map((entry) => entry.material);
}
