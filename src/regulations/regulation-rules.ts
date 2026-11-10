import { parseIfraLimitPercent } from '../formulas/ifra-limit.js';

/**
 * Matching logic of the official regulations. Their definitions (name, zone,
 * sources, substance lists) live in the database; only the way a material's
 * regulatory data maps to each regulation, keyed by the regulation `code`,
 * lives here.
 */

type Regulatory = {
  ifraLimit?: string | number;
  ifraLimitNote?: string;
  ifraReason?: string;
  ifraAmendment?: string;
  rciiiRestriction?: string;
  rciiiNote?: string;
  ghsClassification?: string;
  isAllergen?: boolean;
  allergens?: string[];
  usaMocra?: string;
  usaMocraNote?: string;
  californiaProp65?: string;
  californiaNote?: string;
  chinaCsar?: string;
  chinaNote?: string;
  menaGso?: string;
  menaNote?: string;
};

export interface RuleMaterial {
  id: string;
  name?: string;
  casNumber?: string | null;
  regulatory: unknown;
  /** "Restriction flavor" column of the lab inventory. */
  flavorRestriction?: string | null;
}

export interface RuleHit {
  status: string;
  /** 0 when banned, null when the regulation sets no number. */
  maxPercent: number | null;
  detail: string | null;
}

export interface SubstanceList {
  /** Normalized names and aliases. */
  names: Set<string>;
  cas: Set<string>;
}

export interface RuleContext {
  /** Substances listed by each regulation, by code. */
  substances: Map<string, SubstanceList>;
  /** How the substance list of a regulation without a dedicated rule applies, by code. */
  substanceRules?: Map<string, 'declare' | 'ban'>;
}

const EMPTY_LIST: SubstanceList = { names: new Set(), cas: new Set() };

/** Splits "80-56-8 / 7785-70-8" style CAS fields. */
export const splitCas = (cas: string | null | undefined): string[] =>
  (cas ?? '').split(/[\s/;,]+/).filter((c) => /^\d+-\d+-\d$/.test(c));

type Rule = (
  r: Regulatory,
  m: RuleMaterial,
  ctx: RuleContext,
) => RuleHit | null;

export const normalizeSubstance = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const TO_CHECK = 'À vérifier';
const join = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(' — ') || null;

/** Regional status: listed unless allowed, unlisted or still to check. */
function regional(
  status: string | undefined,
  note: string | undefined,
  ignored: string[],
) {
  if (!status || status === TO_CHECK || ignored.includes(status)) return null;
  return {
    status,
    maxPercent: /interdit/i.test(status) ? 0 : null,
    detail: note ?? null,
  };
}

/**
 * The material's EU allergens, split by list: from its declared allergens
 * (regulatory.allergens) and from its own CAS number (a material that IS an
 * allergen, e.g. Vanillin). Allergens in neither list are returned apart.
 */
export function classifyAllergens(
  r: Regulatory,
  m: RuleMaterial,
  ctx: RuleContext,
) {
  const historicList = ctx.substances.get(EU_ALLERGENS_26) ?? EMPTY_LIST;
  const extendedList = ctx.substances.get(EU_ALLERGENS_EXTENDED) ?? EMPTY_LIST;
  const historic: string[] = [];
  const extended: string[] = [];
  const unlisted: string[] = [];
  for (const allergen of r.allergens ?? []) {
    const key = normalizeSubstance(allergen);
    if (historicList.names.has(key)) historic.push(allergen);
    else if (extendedList.names.has(key)) extended.push(allergen);
    else unlisted.push(allergen);
  }
  const ownCas = splitCas(m.casNumber);
  const selfLabel = 'la matière elle-même (CAS)';
  if (ownCas.some((c) => historicList.cas.has(c)) && historic.length === 0)
    historic.push(selfLabel);
  else if (ownCas.some((c) => extendedList.cas.has(c)) && extended.length === 0)
    extended.push(selfLabel);
  return { historic, extended, unlisted };
}

export const EU_ALLERGENS_26 = 'eu-allergens-26';
export const EU_ALLERGENS_EXTENDED = 'eu-allergens-2023-1545';

export const RULES: Record<string, Rule> = {
  'ifra-cat4': (r) => {
    const limit = parseIfraLimitPercent(r.ifraLimit);
    if (limit === null) return null;
    return {
      status: limit === 0 ? 'Interdite' : `Max ${limit} %`,
      maxPercent: limit,
      detail: join(
        r.ifraAmendment ? `Amendement ${r.ifraAmendment}` : undefined,
        r.ifraReason,
        r.ifraLimitNote,
      ),
    };
  },
  'eu-annex-ii': (r) =>
    r.rciiiRestriction?.startsWith('Annexe II')
      ? { status: 'Interdite', maxPercent: 0, detail: r.rciiiNote ?? null }
      : null,
  'eu-annex-iii': (r) =>
    r.rciiiRestriction === 'Annexe III'
      ? { status: 'Restreinte', maxPercent: null, detail: r.rciiiNote ?? null }
      : null,
  [EU_ALLERGENS_26]: (r, m, ctx) => {
    const { historic } = classifyAllergens(r, m, ctx);
    return historic.length > 0
      ? { status: historic.join(', '), maxPercent: null, detail: null }
      : null;
  },
  // Every material carrying an allergen added by Regulation (EU) 2023/1545.
  // The detail says whether it was already labelled for a historic one.
  [EU_ALLERGENS_EXTENDED]: (r, m, ctx) => {
    const { historic, extended } = classifyAllergens(r, m, ctx);
    if (extended.length === 0) return null;
    return {
      status: extended.join(', '),
      maxPercent: null,
      detail:
        historic.length > 0
          ? `Déjà déclarable au titre des 26 historiques (${historic.join(', ')}).`
          : 'Nouvellement déclarable : aucun des 26 allergènes historiques.',
    };
  },
  ghs: (r) =>
    r.ghsClassification?.trim()
      ? { status: r.ghsClassification.trim(), maxPercent: null, detail: null }
      : null,
  'eu-flavourings': (_r, m) =>
    m.flavorRestriction?.trim()
      ? { status: m.flavorRestriction.trim(), maxPercent: null, detail: null }
      : null,
  'usa-mocra': (r) => regional(r.usaMocra, r.usaMocraNote, ['Autorisé']),
  california: (r) =>
    regional(r.californiaProp65, r.californiaNote, ['Non listé']),
  'china-csar': (r) =>
    regional(r.chinaCsar, r.chinaNote, ['Présent IECIC 2021 – autorisé']),
  'mena-gso': (r) => regional(r.menaGso, r.menaNote, ['Conforme GSO 1943']),
  'to-check': (r, m, ctx) => {
    const { unlisted } = classifyAllergens(r, m, ctx);
    const regions = [
      ['UE', r.rciiiRestriction],
      ['USA', r.usaMocra],
      ['Californie', r.californiaProp65],
      ['Chine', r.chinaCsar],
      ['MENA', r.menaGso],
    ].filter(([, status]) => status === TO_CHECK);
    if (regions.length === 0 && unlisted.length === 0) return null;
    return {
      status: [
        ...regions.map(([region]) => region),
        ...(unlisted.length > 0 ? ['allergènes hors liste UE'] : []),
      ].join(', '),
      maxPercent: null,
      detail:
        unlisted.length > 0
          ? `Allergènes déclarés absents des listes UE (26 et 2023/1545) : ${unlisted.join(', ')}.`
          : null,
    };
  },
};

/**
 * Generic rule for regulations defined by a list of substances: a material is
 * concerned when one of its declared allergens, its CAS number or its own name
 * is in the list.
 */
function matchSubstanceList(
  r: Regulatory,
  m: RuleMaterial,
  list: SubstanceList,
  kind: 'declare' | 'ban',
): RuleHit | null {
  const matched = (r.allergens ?? []).filter((a) =>
    list.names.has(normalizeSubstance(a)),
  );
  const self =
    splitCas(m.casNumber).some((c) => list.cas.has(c)) ||
    (m.name !== undefined && list.names.has(normalizeSubstance(m.name)));
  if (matched.length === 0 && !self) return null;
  const what = [...(self ? ['la matière elle-même'] : []), ...matched].join(
    ', ',
  );
  return kind === 'ban'
    ? {
        status: 'Interdite',
        maxPercent: 0,
        detail: `Substance listée : ${what}.`,
      }
    : { status: what, maxPercent: null, detail: null };
}

export function applyRule(
  code: string,
  material: RuleMaterial,
  ctx: RuleContext,
): RuleHit | null {
  const regulatory = (material.regulatory ?? {}) as Regulatory;
  const rule = RULES[code];
  if (rule) return rule(regulatory, material, ctx);
  const kind = ctx.substanceRules?.get(code);
  const list = ctx.substances.get(code);
  return kind && list
    ? matchSubstanceList(regulatory, material, list, kind)
    : null;
}
