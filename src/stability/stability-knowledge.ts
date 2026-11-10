import {
  normalizeSubstance,
  splitCas,
} from '../regulations/regulation-rules.js';

/**
 * Stability conditions offered when launching a test. The checkpoint days are
 * usual laboratory defaults; they can be changed on each test.
 */
export const STABILITY_CONDITIONS = [
  {
    code: 'ambient',
    label: 'Température ambiante (référence)',
    description:
      "Échantillon témoin à 20–25 °C, à l'abri de la lumière : sert de référence aux autres.",
    checkpoints: [7, 14, 28, 56, 84],
  },
  {
    code: 'fridge_4',
    label: 'Réfrigérateur 4 °C',
    description: 'Révèle les troubles, cristallisations et dépôts au froid.',
    checkpoints: [7, 14, 28, 56, 84],
  },
  {
    code: 'oven_40',
    label: 'Étuve 40 °C',
    description:
      "Vieillissement accéléré : oxydation, hydrolyse, évolution de l'odeur et de la couleur.",
    checkpoints: [7, 14, 28, 56, 84],
  },
  {
    code: 'oven_45',
    label: 'Étuve 45 °C',
    description: 'Vieillissement accéléré plus sévère.',
    checkpoints: [7, 14, 28, 56],
  },
  {
    code: 'oven_50',
    label: 'Étuve 50 °C',
    description:
      'Test de stress court : met vite en évidence les matières instables à la chaleur.',
    checkpoints: [7, 14, 28],
  },
  {
    code: 'freeze_thaw',
    label: 'Cycles gel / dégel',
    description:
      'Alternance −10 °C / 25 °C (24 h chacun) : déphasage, trouble, dépôt.',
    checkpoints: [3, 6, 9, 12],
  },
  {
    code: 'light_uv',
    label: 'Lumière UV (enceinte)',
    description: 'Exposition UV contrôlée : décoloration et photo-oxydation.',
    checkpoints: [1, 3, 7, 14],
  },
  {
    code: 'window',
    label: 'Lumière naturelle (fenêtre)',
    description: 'Exposition à la lumière du jour derrière une vitre.',
    checkpoints: [7, 14, 28, 56],
  },
  {
    code: 'other',
    label: 'Autre condition',
    description: 'Condition personnalisée (décrite dans le libellé).',
    checkpoints: [7, 14, 28],
  },
] as const;

export type ConditionCode = (typeof STABILITY_CONDITIONS)[number]['code'];
export const CONDITION_CODES = STABILITY_CONDITIONS.map(
  (c) => c.code,
) as string[];

export const STABILITY_BASES = [
  { code: 'alcohol', label: 'Alcool (parfum fin)' },
  { code: 'pure', label: 'Concentré pur' },
  { code: 'cream', label: 'Crème / lait' },
  { code: 'shower_gel', label: 'Gel douche / shampooing' },
  { code: 'soap', label: 'Savon' },
  { code: 'candle', label: 'Bougie' },
  { code: 'diffuser', label: 'Diffuseur' },
  { code: 'detergent', label: 'Lessive / détergent' },
  { code: 'other', label: 'Autre base' },
] as const;
export const BASE_CODES = STABILITY_BASES.map((b) => b.code) as string[];

export type RiskType =
  'oxidation' | 'light' | 'heat' | 'ph' | 'hydrolysis' | 'discoloration';

export const RISK_LABELS: Record<RiskType, string> = {
  oxidation: 'Oxydation',
  light: 'Lumière / UV',
  heat: 'Chaleur',
  ph: 'pH extrême',
  hydrolysis: 'Hydrolyse / humidité',
  discoloration: 'Décoloration',
};

/** Tests that reveal each risk. */
const TESTS_FOR_RISK: Record<RiskType, string[]> = {
  oxidation: ['oven_40', 'window'],
  light: ['light_uv', 'window'],
  heat: ['oven_40', 'oven_50'],
  ph: ['oven_40'],
  hydrolysis: ['oven_40', 'freeze_thaw'],
  discoloration: ['light_uv', 'oven_40'],
};

/** Always recommended: the reference sample and the basic accelerated tests. */
const BASELINE_TESTS = ['ambient', 'fridge_4', 'oven_40'];

const PATTERNS: Record<RiskType, RegExp> = {
  oxidation: /o₂|\bo2\b|oxyg|oxid|oxyd|peroxid|autoxid|air\b/i,
  light: /\buv\b|light|lumi[eè]re|photo/i,
  heat: /t\s*[>≥]|°\s*c|heat|chaleur|temp[ée]rature|thermal|thermique/i,
  ph: /\bph\b/i,
  hydrolysis: /hydroly|moist|humid|water|eau\b/i,
  discoloration: /discolo|colou?r|yellow|brown|darken|jaun|brun|color/i,
};

type Regulatory = {
  physicoChemicalIssue?: string;
  triggeringConditions?: string;
  impactResult?: string;
  recombi?: string;
  recombiRisk?: boolean;
};

export interface SpecInput {
  substance: string;
  casNumber: string | null;
  aliases: unknown;
  parameter: string;
  maxValue: number;
  unit: string;
  note: string | null;
  sourceRef: number | null;
}

export interface MaterialInput {
  id: string;
  name: string;
  casNumber: string | null;
  regulatory: unknown;
}

export interface MaterialStability {
  materialId: string;
  material: string;
  /** "Stable" when the data says so explicitly. */
  stable: boolean;
  risks: RiskType[];
  issue: string | null;
  triggers: string | null;
  /** The triggering conditions split into clean factors. */
  triggerFactors: TriggerFactor[];
  impact: string | null;
  compatibility: string | null;
  specs: Omit<SpecInput, 'aliases'>[];
}

const clean = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v && !/^(-|\?|non|no|n\/a|aucun)$/i.test(v) ? v : null;
};

/** Known stability data of one material: supplier / RADAR data and official specs. */
export function materialStability(
  material: MaterialInput,
  specs: SpecInput[],
): MaterialStability {
  const r = (material.regulatory ?? {}) as Regulatory;
  const issue = clean(r.physicoChemicalIssue);
  const triggers = clean(r.triggeringConditions);
  const impact = clean(r.impactResult);
  const stable = !!issue && /^stable$/i.test(issue);
  const text = [stable ? '' : issue, triggers, impact]
    .filter(Boolean)
    .join(' ');

  const risks = (Object.keys(PATTERNS) as RiskType[]).filter((risk) =>
    PATTERNS[risk].test(text),
  );

  const ownCas = new Set(splitCas(material.casNumber));
  const ownName = normalizeSubstance(material.name);
  const matchingSpecs = specs.filter((spec) => {
    if (splitCas(spec.casNumber).some((c) => ownCas.has(c))) return true;
    const names = [
      spec.substance,
      ...(Array.isArray(spec.aliases) ? spec.aliases : []),
    ];
    return names.some(
      (n) => typeof n === 'string' && normalizeSubstance(n) === ownName,
    );
  });
  if (
    matchingSpecs.some((s) => s.parameter === 'peroxide_value') &&
    !risks.includes('oxidation')
  ) {
    risks.unshift('oxidation');
  }

  return {
    materialId: material.id,
    material: material.name,
    stable: stable && risks.length === 0,
    risks,
    issue,
    triggers,
    triggerFactors: parseTriggers(triggers),
    impact,
    compatibility: clean(r.recombi),
    specs: matchingSpecs.map(({ aliases: _aliases, ...spec }) => spec),
  };
}

export interface FormulaRiskReport {
  materials: (MaterialStability & { percent: number | null })[];
  /** Number of materials concerned by each risk. */
  riskCounts: Partial<Record<RiskType, number>>;
  recommended: { condition: string; reasons: string[] }[];
  /** Materials without any stability data. */
  unknownCount: number;
}

/** Stability risks of a formula and the tests to run. */
export function formulaRisks(
  lines: { material: MaterialInput; percent: number | null }[],
  specs: SpecInput[],
): FormulaRiskReport {
  const materials = lines.map(({ material, percent }) => ({
    ...materialStability(material, specs),
    percent,
  }));

  const riskCounts: Partial<Record<RiskType, number>> = {};
  for (const m of materials)
    for (const risk of m.risks) riskCounts[risk] = (riskCounts[risk] ?? 0) + 1;

  const reasons = new Map<string, string[]>(
    BASELINE_TESTS.map((c) => [c, ['Protocole de base']]),
  );
  for (const [risk, count] of Object.entries(riskCounts) as [
    RiskType,
    number,
  ][]) {
    for (const condition of TESTS_FOR_RISK[risk]) {
      const list = reasons.get(condition) ?? [];
      list.push(
        `${RISK_LABELS[risk]} (${count} matière${count > 1 ? 's' : ''})`,
      );
      reasons.set(condition, list);
    }
  }
  const order = STABILITY_CONDITIONS.map((c) => c.code as string);
  const recommended = [...reasons.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([condition, why]) => ({ condition, reasons: why }));

  return {
    materials: materials.sort((a, b) => b.risks.length - a.risks.length),
    riskCounts,
    recommended,
    unknownCount: materials.filter(
      (m) => !m.issue && !m.triggers && !m.impact && m.specs.length === 0,
    ).length,
  };
}

export type Grade = 'conform' | 'slight' | 'altered';

/** Worst grade of an observation (appearance other than clear counts as altered). */
export function observationGrade(o: {
  odor: string;
  color: string;
  appearance: string;
}): Grade {
  const grades = [
    o.odor,
    o.color,
    o.appearance === 'clear'
      ? 'conform'
      : o.appearance === 'hazy'
        ? 'slight'
        : 'altered',
  ];
  if (grades.includes('altered')) return 'altered';
  if (grades.includes('slight')) return 'slight';
  return 'conform';
}

export interface Checkpoint {
  day: number;
  dueDate: Date;
  done: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

export function checkpointsOf(
  startDate: Date,
  days: unknown,
  observedDays: (number | null)[],
): Checkpoint[] {
  const list = Array.isArray(days)
    ? days.filter((d): d is number => typeof d === 'number')
    : [];
  const done = new Set(observedDays.filter((d): d is number => d !== null));
  return [...new Set(list)]
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      dueDate: new Date(startDate.getTime() + day * DAY),
      done: done.has(day),
    }));
}

// ── Triggering conditions ─────────────────────────────────────────────────

export type TriggerKind =
  | 'oxygen'
  | 'light'
  | 'heat'
  | 'cold'
  | 'ph'
  | 'moisture'
  | 'solvent'
  | 'duration';

export interface TriggerFactor {
  kind: TriggerKind;
  label: string;
}

const TRIGGER_ORDER: TriggerKind[] = [
  'oxygen',
  'light',
  'heat',
  'cold',
  'moisture',
  'ph',
  'solvent',
  'duration',
];

const UNITS: Record<string, string> = {
  h: 'h',
  hour: 'h',
  hours: 'h',
  day: 'jours',
  days: 'jours',
  week: 'semaines',
  weeks: 'semaines',
  semaines: 'semaines',
  month: 'mois',
  months: 'mois',
  mois: 'mois',
};

const range = (a: string, b?: string) => (b ? `${a}–${b}` : a);

/**
 * Splits a free-text "triggering conditions" cell (English or French, e.g.
 * "O₂; UV; T > 25 °C" or "pH < 4 or > 9; T > 40 °C; water > 5%") into clean
 * factors: oxygen, light, temperature, pH, moisture, solvent and duration.
 */
export function parseTriggers(text: string | null): TriggerFactor[] {
  if (!text) return [];
  const t = text.replace(/\s+/g, ' ');
  const factors: TriggerFactor[] = [];
  const add = (kind: TriggerKind, label: string) => {
    if (!factors.some((f) => f.kind === kind && f.label === label))
      factors.push({ kind, label });
  };

  if (/o₂|\bo2\b|oxyg|\bair\b|l[’']air|oxid/i.test(t))
    add('oxygen', 'Oxygène / air');

  const wave = t.match(/(\d{3})\s*[–-]\s*(\d{3})\s*nm/i);
  if (/\buv\b/i.test(t))
    add('light', wave ? `UV ${wave[1]}–${wave[2]} nm` : 'UV');
  if (/light|lumi[eè]re/i.test(t)) add('light', 'Lumière');

  // Temperatures: "T > 25 °C", "≥25 °C", "~25–40 °C", "40–45°C", "below ~15 °C", ">30 °C".
  const tempRe =
    /(below|under|en dessous de|<|>|≥|≤)?\s*~?\s*(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*°\s*C/gi;
  for (const m of t.matchAll(tempRe)) {
    const op = (m[1] ?? '').toLowerCase();
    const value = range(m[2], m[3]);
    if (
      op === '<' ||
      op === '≤' ||
      op === 'below' ||
      op === 'under' ||
      op === 'en dessous de'
    ) {
      add('cold', `T < ${value} °C`);
    } else if (op === '>' || op === '≥') {
      add('heat', `T ${op === '≥' ? '≥' : '>'} ${value} °C`);
    } else {
      add('heat', `${value} °C`);
    }
  }
  if (/\bRT\b/.test(t)) add('heat', 'Température ambiante');
  if (/heat|chaleur/i.test(t) && !factors.some((f) => f.kind === 'heat'))
    add('heat', 'Chaleur');

  // pH: "pH < 4 or > 9", "pH < 5", "alkaline conditions (pH > 8)", "pH extrêmes".
  const ph = t.match(
    /pH\s*([<>])\s*(\d+(?:[.,]\d+)?)(?:\s*(?:or|ou)\s*([<>])\s*(\d+(?:[.,]\d+)?))?/i,
  );
  if (ph)
    add('ph', `pH ${ph[1]} ${ph[2]}${ph[3] ? ` ou ${ph[3]} ${ph[4]}` : ''}`);
  else if (/ph extr|alkaline|alcalin|acid/i.test(t)) add('ph', 'pH extrême');

  // Moisture: "water > 5%", "water presence", "humidity", ">60% RH", "75% RH".
  const water = t.match(/(?:water|moisture|eau)\s*>\s*(\d+)\s*%/i);
  const rh = t.match(/>?\s*(\d{2})\s*%\s*RH/i);
  if (water) add('moisture', `Eau > ${water[1]} %`);
  if (rh) add('moisture', `HR ${/>\s*\d/.test(rh[0]) ? '> ' : ''}${rh[1]} %`);
  if (!water && !rh && /water|moist|humid|eau\b/i.test(t))
    add('moisture', 'Eau / humidité');

  if (/ethanol|solvant|solvent|\bsolvan/i.test(t))
    add('solvent', /ethanol/i.test(t) ? 'Solution alcoolique' : 'Solvant');

  // Durations: "~24–72 h", "1–2 months", "2–6 weeks", "weeks–months", "several weeks".
  const durRe =
    /~?\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*(h|hours?|days?|weeks?|months?|semaines|mois)\b/gi;
  for (const m of t.matchAll(durRe)) {
    add(
      'duration',
      `${range(m[1], m[2])} ${UNITS[m[3].toLowerCase()] ?? m[3]}`,
    );
  }
  const vague = t.match(/(days|weeks)\s*[–-]\s*(weeks|months)/i);
  if (vague)
    add(
      'duration',
      `${UNITS[vague[1].toLowerCase()]} à ${UNITS[vague[2].toLowerCase()]}`,
    );
  if (!vague && /several weeks|plusieurs semaines|for weeks/i.test(t))
    add('duration', 'Plusieurs semaines');
  if (
    !vague &&
    !factors.some((f) => f.kind === 'duration' && f.label.endsWith('mois')) &&
    /\bmonths\b/i.test(t)
  ) {
    add('duration', 'Plusieurs mois');
  }
  if (/prolong|long storage|stockage long/i.test(t))
    add('duration', 'Stockage prolongé');

  return factors.sort(
    (a, b) => TRIGGER_ORDER.indexOf(a.kind) - TRIGGER_ORDER.indexOf(b.kind),
  );
}
