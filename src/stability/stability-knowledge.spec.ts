import { describe, expect, it } from 'vitest';
import {
  checkpointsOf,
  formulaRisks,
  materialStability,
  observationGrade,
  parseTriggers,
  type SpecInput,
} from './stability-knowledge.js';

const specs: SpecInput[] = [
  {
    substance: 'Limonene',
    casNumber: '5989-27-5 / 138-86-3',
    aliases: ['d-Limonene'],
    parameter: 'peroxide_value',
    maxValue: 20,
    unit: 'mmol/L',
    note: null,
    sourceRef: 8,
  },
];
const material = (
  name: string,
  regulatory: object,
  casNumber: string | null = null,
) => ({
  id: name,
  name,
  casNumber,
  regulatory,
});

describe('materialStability', () => {
  it('reads risks from the RADAR fields', () => {
    const m = materialStability(
      material('Bergamote', {
        physicoChemicalIssue: 'Oxidation',
        triggeringConditions: 'O₂; UV; T > 25 °C',
        impactResult: 'Slight discoloration, odor modification',
      }),
      specs,
    );
    expect(m.risks).toEqual(
      expect.arrayContaining(['oxidation', 'light', 'heat', 'discoloration']),
    );
    expect(m.stable).toBe(false);
  });

  it('detects pH and hydrolysis', () => {
    const m = materialStability(
      material('Ester', {
        physicoChemicalIssue: 'Ester hydrolysis',
        triggeringConditions: 'pH < 4 or > 9; T > 40 °C; moisture',
      }),
      specs,
    );
    expect(m.risks).toEqual(
      expect.arrayContaining(['hydrolysis', 'ph', 'heat']),
    );
  });

  it('keeps stable materials without risks', () => {
    expect(
      materialStability(
        material('Iso E', { physicoChemicalIssue: 'Stable' }),
        specs,
      ),
    ).toMatchObject({
      stable: true,
      risks: [],
    });
  });

  it('attaches official specs by CAS or name and flags oxidation', () => {
    const byCas = materialStability(
      material('D-limonène', {}, '5989-27-5'),
      specs,
    );
    expect(byCas.specs).toHaveLength(1);
    expect(byCas.risks).toContain('oxidation');
    expect(
      materialStability(material('d-Limonene', {}), specs).specs,
    ).toHaveLength(1);
  });
});

describe('formulaRisks', () => {
  it('recommends the base protocol plus tests for each risk', () => {
    const report = formulaRisks(
      [
        {
          material: material('A', {
            triggeringConditions: 'Oxygen + light ~24–72 h',
          }),
          percent: 10,
        },
        { material: material('B', {}), percent: 90 },
      ],
      specs,
    );
    const conditions = report.recommended.map((r) => r.condition);
    expect(conditions).toEqual(
      expect.arrayContaining([
        'ambient',
        'fridge_4',
        'oven_40',
        'light_uv',
        'window',
      ]),
    );
    expect(report.riskCounts.light).toBe(1);
    expect(report.unknownCount).toBe(1);
    expect(report.materials[0].material).toBe('A');
  });
});

describe('observations and checkpoints', () => {
  it('grades an observation by its worst criterion', () => {
    expect(
      observationGrade({
        odor: 'conform',
        color: 'conform',
        appearance: 'clear',
      }),
    ).toBe('conform');
    expect(
      observationGrade({
        odor: 'conform',
        color: 'slight',
        appearance: 'clear',
      }),
    ).toBe('slight');
    expect(
      observationGrade({
        odor: 'conform',
        color: 'conform',
        appearance: 'hazy',
      }),
    ).toBe('slight');
    expect(
      observationGrade({
        odor: 'conform',
        color: 'conform',
        appearance: 'deposit',
      }),
    ).toBe('altered');
  });

  it('schedules checkpoints and marks the observed ones', () => {
    const list = checkpointsOf(
      new Date('2026-01-01T00:00:00Z'),
      [28, 7, 7, 14],
      [7],
    );
    expect(list.map((c) => c.day)).toEqual([7, 14, 28]);
    expect(list[0]).toMatchObject({ done: true });
    expect(list[1].dueDate.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });
});

describe('parseTriggers', () => {
  const labels = (text: string) =>
    parseTriggers(text).map((f) => `${f.kind}:${f.label}`);

  it('splits the short RADAR notation', () => {
    expect(labels('O₂; UV; T > 25 °C')).toEqual([
      'oxygen:Oxygène / air',
      'light:UV',
      'heat:T > 25 °C',
    ]);
    expect(labels('pH < 4 or > 9; T > 40 °C; water > 5%')).toEqual([
      'heat:T > 40 °C',
      'moisture:Eau > 5 %',
      'ph:pH < 4 ou > 9',
    ]);
  });

  it('reads sentences, wavelengths, ranges, cold and durations', () => {
    expect(labels('UV exposure 300–400 nm for ~24–72 h')).toEqual([
      'light:UV 300–400 nm',
      'duration:24–72 h',
    ]);
    expect(labels('Temperature below ~15 °C in ethanol solutions')).toEqual([
      'cold:T < 15 °C',
      'solvent:Solution alcoolique',
    ]);
    expect(labels('Air + heat >25 °C for weeks–months')).toEqual([
      'oxygen:Oxygène / air',
      'heat:T > 25 °C',
      'duration:semaines à mois',
    ]);
    expect(labels('High humidity (>60% RH), >30 °C, months')).toEqual([
      'heat:T > 30 °C',
      'moisture:HR > 60 %',
      'duration:Plusieurs mois',
    ]);
  });

  it('handles French text and empty values', () => {
    expect(labels('Humidité + pH extrêmes + ~40 °C')).toEqual([
      'heat:40 °C',
      'moisture:Eau / humidité',
      'ph:pH extrême',
    ]);
    expect(parseTriggers(null)).toEqual([]);
  });
});
