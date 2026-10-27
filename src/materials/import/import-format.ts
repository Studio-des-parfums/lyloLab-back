import { FACETS } from '../../ai/formula-changes.js';

/**
 * Columns understood by the material import. A column is recognised when its
 * header, once normalised (see normalizeHeader), equals one of the aliases.
 * Served as-is to the frontend, which shows it as the import guide.
 */
export type ImportFieldKey =
  | 'name'
  | 'casNumber'
  | 'family'
  | 'nature'
  | 'sensation'
  | 'subjectivePower'
  | 'ifraLimit'
  | 'allergens'
  | 'supplier'
  | 'producer'
  | 'location'
  | 'stock'
  | 'adjacentNote'
  | 'regulation'
  | 'freeNote'
  | 'visualAspect'
  | 'flashPoint'
  | 'physicochemicalState'
  | 'waterBase';

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  required?: boolean;
  /** Accepted column headers (compared without accents, case or punctuation). */
  aliases: string[];
  hint?: string;
}

export const IMPORT_FIELDS: ImportField[] = [
  {
    key: 'name',
    label: 'Nom',
    required: true,
    aliases: ['Nom', 'Name', 'Matière première', 'Matière', 'MP', 'Ingrédient', 'Produit', 'Désignation', 'Raw material'],
    hint: "Une matière déjà présente sous le même nom est mise à jour au lieu d'être recréée.",
  },
  { key: 'casNumber', label: 'N° CAS', aliases: ['CAS', 'N° CAS', 'Numéro CAS', 'CAS number', 'CAS No'], hint: 'ex. 78-70-6' },
  { key: 'family', label: 'Famille', aliases: ['Famille', 'Famille olfactive', 'Family'] },
  { key: 'nature', label: 'Nature', aliases: ['Nature', 'Origine', 'Type'], hint: 'Naturelle ou Synthétique' },
  {
    key: 'sensation',
    label: 'Description olfactive',
    aliases: ['Description olfactive', 'Sensation', 'Odeur', 'Description', 'Profil olfactif'],
  },
  { key: 'subjectivePower', label: 'Puissance', aliases: ['Puissance', 'Puissance subjective', 'Intensité', 'Power'], hint: 'nombre' },
  {
    key: 'ifraLimit',
    label: 'Limite IFRA Cat.4',
    aliases: ['Limite IFRA', 'IFRA', 'IFRA Cat 4', 'IFRA Cat.4', 'Limite IFRA Cat 4'],
    hint: '« 0,6 % », « Interdite » ou « Aucune limite »',
  },
  {
    key: 'allergens',
    label: 'Allergènes UE',
    aliases: ['Allergènes', 'Allergènes UE', 'Allergens'],
    hint: 'séparés par des virgules, ex. Linalool, Limonene',
  },
  { key: 'supplier', label: 'Fournisseur', aliases: ['Fournisseur', 'Supplier', 'Distributeur'] },
  { key: 'producer', label: 'Producteur', aliases: ['Producteur', 'Fabricant', 'Producer', 'Manufacturer'] },
  { key: 'location', label: 'Emplacement', aliases: ['Emplacement', 'Rangement', 'Localisation', 'Location'] },
  {
    key: 'stock',
    label: 'Stock',
    aliases: ['Stock', 'Stock (g)', 'Stock g', 'Quantité', 'Quantité (g)', 'Qté'],
    hint: 'en grammes (« 250 ») ou avec unité (« 1,5 kg »)',
  },
  { key: 'adjacentNote', label: 'Note adjacente', aliases: ['Note adjacente', 'Notes adjacentes'] },
  { key: 'regulation', label: 'Règlementation', aliases: ['Règlementation', 'Réglementation', 'Regulation'] },
  { key: 'freeNote', label: 'Note libre', aliases: ['Note libre', 'Commentaire', 'Commentaires', 'Remarque', 'Remarques'] },
  { key: 'visualAspect', label: 'Aspect visuel', aliases: ['Aspect visuel', 'Aspect', 'Apparence'] },
  { key: 'flashPoint', label: 'Flash point', aliases: ['Flash point', 'Point éclair', "Point d'éclair"] },
  {
    key: 'physicochemicalState',
    label: 'État physicochimique',
    aliases: ['État physicochimique', 'État physico-chimique', 'État', 'État physique'],
  },
  { key: 'waterBase', label: 'Water base', aliases: ['Water base', 'Base eau', 'Hydrosoluble'], hint: 'Oui ou Non' },
];

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.csv', '.tsv', '.txt', '.json'];
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const DESCRIPTOR_MAX = 9;

export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FIELD_BY_ALIAS = new Map<string, ImportFieldKey>(
  IMPORT_FIELDS.flatMap((field) => field.aliases.map((alias) => [normalizeHeader(alias), field.key])),
);
const FACET_BY_HEADER = new Map<string, string>(FACETS.map((facet) => [normalizeHeader(facet), facet]));

export type ColumnTarget = { kind: 'field'; key: ImportFieldKey } | { kind: 'facet'; facet: string };

export function columnTarget(header: string): ColumnTarget | null {
  const normalized = normalizeHeader(header);
  const key = FIELD_BY_ALIAS.get(normalized);
  if (key) return { kind: 'field', key };
  const facet = FACET_BY_HEADER.get(normalized);
  return facet ? { kind: 'facet', facet } : null;
}

/** What GET /materials/import/format returns: the guide shown before choosing a file. */
export function importFormat() {
  return {
    fields: IMPORT_FIELDS,
    facets: [...FACETS],
    descriptorMax: DESCRIPTOR_MAX,
    acceptedExtensions: ACCEPTED_EXTENSIONS,
    maxSizeMb: MAX_IMPORT_BYTES / 1024 / 1024,
  };
}
