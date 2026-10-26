// Vocabulary shared with the frontend (frontend/src/data/facetMapping.ts and
// adjustmentMapping.ts). Keep both lists in sync.
export const FACETS = [
  'Acidulé',
  'Sec',
  'Aldéhydé',
  'Fraicheur',
  'Vert',
  'Camphré',
  'Aromatique',
  'Epicé',
  'Résineux',
  'Musqué',
  'Ambré',
  'Poudré',
  'Chypré',
  'Gras',
  'Animalisé',
  'Boisé',
  'Terreux',
  'Balsamique',
  'Fumé',
  'Marin',
  'Floral',
  'Gourmand',
  'Lacté',
  'Fruité',
] as const;

export const ADJUSTMENTS = [
  'Diffusion / Sillage',
  'Tenue',
  'Puissance',
  'Douceur',
  'Originalité',
] as const;

/**
 * A change the assistant proposes on the open formula. Nothing is applied
 * server-side: the frontend shows the proposal and applies it only once the
 * user accepts it.
 */
export type FormulaChange =
  | { type: 'set_facet'; facet: string; value: number }
  | { type: 'set_adjustment'; adjustment: string; value: number }
  | { type: 'add_material'; materialId: string; material: string }
  | { type: 'remove_material'; materialId: string; material: string }
  | {
      type: 'set_percentages';
      items: { materialId: string; material: string; percent: number }[];
    }
  | { type: 'reset_auto_distribution' }
  | { type: 'rename_formula'; name: string }
  | { type: 'set_total_volume'; ml: number };

export interface FormulaProposal {
  summary: string;
  changes: FormulaChange[];
}

function object(properties: Record<string, unknown>) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const typeTag = (type: string) => ({ type: 'string', enum: [type] });

/** Strict JSON schema of the model's answer (OpenAI Structured Outputs). */
export const ASSISTANT_RESPONSE_SCHEMA = object({
  message: {
    type: 'string',
    description: 'Réponse au parfumeur, en français, au format texte simple.',
  },
  proposal: {
    anyOf: [
      { type: 'null' },
      object({
        summary: {
          type: 'string',
          description: 'Résumé en une phrase des modifications proposées.',
        },
        changes: {
          type: 'array',
          items: {
            anyOf: [
              object({
                type: typeTag('set_facet'),
                facet: { type: 'string', enum: [...FACETS] },
                value: { type: 'number', description: '0 à 100' },
              }),
              object({
                type: typeTag('set_adjustment'),
                adjustment: { type: 'string', enum: [...ADJUSTMENTS] },
                value: { type: 'number', description: '0 à 100' },
              }),
              object({
                type: typeTag('add_material'),
                material: { type: 'string', description: 'Nom exact du catalogue' },
              }),
              object({
                type: typeTag('remove_material'),
                material: { type: 'string', description: 'Nom exact du catalogue' },
              }),
              object({
                type: typeTag('set_percentages'),
                items: {
                  type: 'array',
                  items: object({
                    material: { type: 'string', description: 'Nom exact du catalogue' },
                    percent: { type: 'number' },
                  }),
                },
              }),
              object({ type: typeTag('reset_auto_distribution') }),
              object({ type: typeTag('rename_formula'), name: { type: 'string' } }),
              object({
                type: typeTag('set_total_volume'),
                ml: { type: 'number' },
              }),
            ],
          },
        },
      }),
    ],
  },
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type RawChange = Record<string, unknown> & { type: string };

/**
 * Turns the model's raw proposal into validated changes: material names are
 * resolved to catalog ids (case-insensitive), values are clamped, and any
 * change that cannot be resolved is dropped and reported as a warning.
 */
export function resolveProposal(
  raw: { summary: string; changes: RawChange[] },
  materialIdByName: Map<string, { id: string; name: string }>,
): { proposal: FormulaProposal | null; warnings: string[] } {
  const warnings: string[] = [];
  const changes: FormulaChange[] = [];

  const findMaterial = (name: unknown) => {
    const material = materialIdByName.get(String(name).trim().toLowerCase());
    if (!material) warnings.push(`Matière inconnue ignorée : « ${String(name)} ».`);
    return material;
  };

  for (const change of raw.changes) {
    switch (change.type) {
      case 'set_facet':
        if ((FACETS as readonly string[]).includes(String(change.facet))) {
          changes.push({
            type: 'set_facet',
            facet: String(change.facet),
            value: Math.round(clamp(Number(change.value), 0, 100)),
          });
        }
        break;
      case 'set_adjustment':
        if ((ADJUSTMENTS as readonly string[]).includes(String(change.adjustment))) {
          changes.push({
            type: 'set_adjustment',
            adjustment: String(change.adjustment),
            value: Math.round(clamp(Number(change.value), 0, 100)),
          });
        }
        break;
      case 'add_material':
      case 'remove_material': {
        const material = findMaterial(change.material);
        if (material) {
          changes.push({
            type: change.type,
            materialId: material.id,
            material: material.name,
          });
        }
        break;
      }
      case 'set_percentages': {
        const items = (change.items as { material: string; percent: number }[])
          .map((item) => {
            const material = findMaterial(item.material);
            return material
              ? {
                  materialId: material.id,
                  material: material.name,
                  percent: clamp(Number(item.percent), 0, 100),
                }
              : null;
          })
          .filter((item) => item !== null);
        if (items.length > 0) changes.push({ type: 'set_percentages', items });
        break;
      }
      case 'reset_auto_distribution':
        changes.push({ type: 'reset_auto_distribution' });
        break;
      case 'rename_formula': {
        const name = String(change.name).trim();
        if (name) changes.push({ type: 'rename_formula', name });
        break;
      }
      case 'set_total_volume': {
        const ml = Number(change.ml);
        if (Number.isFinite(ml) && ml > 0) changes.push({ type: 'set_total_volume', ml });
        break;
      }
    }
  }

  return {
    proposal: changes.length > 0 ? { summary: raw.summary, changes } : null,
    warnings,
  };
}
