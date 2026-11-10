/**
 * Countries and regions used as material origins. `isoNumeric` is the ISO
 * 3166-1 numeric code, used to place the country on the world map.
 */
export const COUNTRIES: {
  name: string;
  isoNumeric: string | null;
  continent: string;
  kind: 'country' | 'region';
}[] = [
  {
    name: 'Afrique du Sud',
    isoNumeric: '710',
    continent: 'Afrique',
    kind: 'country',
  },
  { name: 'Albanie', isoNumeric: '008', continent: 'Europe', kind: 'country' },
  {
    name: 'Argentine',
    isoNumeric: '032',
    continent: 'Amérique du Sud',
    kind: 'country',
  },
  {
    name: 'Australie',
    isoNumeric: '036',
    continent: 'Océanie',
    kind: 'country',
  },
  { name: 'Autriche', isoNumeric: '040', continent: 'Europe', kind: 'country' },
  {
    name: 'Brésil',
    isoNumeric: '076',
    continent: 'Amérique du Sud',
    kind: 'country',
  },
  { name: 'Bulgarie', isoNumeric: '100', continent: 'Europe', kind: 'country' },
  {
    name: 'Canada',
    isoNumeric: '124',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  { name: 'Chine', isoNumeric: '156', continent: 'Asie', kind: 'country' },
  {
    name: 'Colombie',
    isoNumeric: '170',
    continent: 'Amérique du Sud',
    kind: 'country',
  },
  { name: 'Comores', isoNumeric: '174', continent: 'Afrique', kind: 'country' },
  {
    name: 'Corée du Sud',
    isoNumeric: '410',
    continent: 'Asie',
    kind: 'country',
  },
  {
    name: "Côte d'Ivoire",
    isoNumeric: '384',
    continent: 'Afrique',
    kind: 'country',
  },
  {
    name: 'Dominique',
    isoNumeric: '212',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  { name: 'Égypte', isoNumeric: '818', continent: 'Afrique', kind: 'country' },
  { name: 'Espagne', isoNumeric: '724', continent: 'Europe', kind: 'country' },
  {
    name: 'États-Unis',
    isoNumeric: '840',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  {
    name: 'Éthiopie',
    isoNumeric: '231',
    continent: 'Afrique',
    kind: 'country',
  },
  { name: 'Finlande', isoNumeric: '246', continent: 'Europe', kind: 'country' },
  { name: 'France', isoNumeric: '250', continent: 'Europe', kind: 'country' },
  {
    name: 'Guatemala',
    isoNumeric: '320',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  {
    name: 'Haïti',
    isoNumeric: '332',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  {
    name: 'Honduras',
    isoNumeric: '340',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  { name: 'Hongrie', isoNumeric: '348', continent: 'Europe', kind: 'country' },
  { name: 'Inde', isoNumeric: '356', continent: 'Asie', kind: 'country' },
  { name: 'Indonésie', isoNumeric: '360', continent: 'Asie', kind: 'country' },
  { name: 'Iran', isoNumeric: '364', continent: 'Asie', kind: 'country' },
  { name: 'Italie', isoNumeric: '380', continent: 'Europe', kind: 'country' },
  {
    name: 'Jamaïque',
    isoNumeric: '388',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  { name: 'Laos', isoNumeric: '418', continent: 'Asie', kind: 'country' },
  {
    name: 'Macédoine du Nord',
    isoNumeric: '807',
    continent: 'Europe',
    kind: 'country',
  },
  {
    name: 'Madagascar',
    isoNumeric: '450',
    continent: 'Afrique',
    kind: 'country',
  },
  { name: 'Malaisie', isoNumeric: '458', continent: 'Asie', kind: 'country' },
  { name: 'Maroc', isoNumeric: '504', continent: 'Afrique', kind: 'country' },
  {
    name: 'Mexique',
    isoNumeric: '484',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  { name: 'Moldavie', isoNumeric: '498', continent: 'Europe', kind: 'country' },
  { name: 'Népal', isoNumeric: '524', continent: 'Asie', kind: 'country' },
  {
    name: 'Nouvelle-Calédonie',
    isoNumeric: '540',
    continent: 'Océanie',
    kind: 'country',
  },
  {
    name: 'Paraguay',
    isoNumeric: '600',
    continent: 'Amérique du Sud',
    kind: 'country',
  },
  {
    name: 'Pérou',
    isoNumeric: '604',
    continent: 'Amérique du Sud',
    kind: 'country',
  },
  {
    name: 'Philippines',
    isoNumeric: '608',
    continent: 'Asie',
    kind: 'country',
  },
  { name: 'Russie', isoNumeric: '643', continent: 'Europe', kind: 'country' },
  {
    name: 'Salvador',
    isoNumeric: '222',
    continent: 'Amérique du Nord',
    kind: 'country',
  },
  { name: 'Somalie', isoNumeric: '706', continent: 'Afrique', kind: 'country' },
  { name: 'Sri Lanka', isoNumeric: '144', continent: 'Asie', kind: 'country' },
  { name: 'Togo', isoNumeric: '768', continent: 'Afrique', kind: 'country' },
  { name: 'Tunisie', isoNumeric: '788', continent: 'Afrique', kind: 'country' },
  { name: 'Turquie', isoNumeric: '792', continent: 'Asie', kind: 'country' },
  { name: 'Ukraine', isoNumeric: '804', continent: 'Europe', kind: 'country' },
  {
    name: 'Venezuela',
    isoNumeric: '862',
    continent: 'Amérique du Sud',
    kind: 'country',
  },
  { name: 'Vietnam', isoNumeric: '704', continent: 'Asie', kind: 'country' },
  { name: 'Afrique', isoNumeric: null, continent: 'Afrique', kind: 'region' },
  {
    name: 'Amérique du Sud',
    isoNumeric: null,
    continent: 'Amérique du Sud',
    kind: 'region',
  },
  { name: 'Asie', isoNumeric: null, continent: 'Asie', kind: 'region' },
  {
    name: 'Asie du Sud-Est',
    isoNumeric: null,
    continent: 'Asie',
    kind: 'region',
  },
  { name: 'Balkans', isoNumeric: null, continent: 'Europe', kind: 'region' },
  { name: 'Europe', isoNumeric: null, continent: 'Europe', kind: 'region' },
  {
    name: 'Océan Indien',
    isoNumeric: null,
    continent: 'Afrique',
    kind: 'region',
  },
];

export const normalizePlace = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Spellings, regions and typos found in the lab files, mapped to a country name. */
const ALIASES: Record<string, string> = {
  provence: 'France',
  'haute provence': 'France',
  alaska: 'États-Unis',
  virginie: 'États-Unis',
  usa: 'États-Unis',
  'etat-unis': 'États-Unis',
  'etats-unis': 'États-Unis',
  sumatra: 'Indonésie',
  java: 'Indonésie',
  sulawesi: 'Indonésie',
  indonesia: 'Indonésie',
  ceylan: 'Sri Lanka',
  comoros: 'Comores',
  'comoro island': 'Comores',
  'dominica island': 'Dominique',
  morocco: 'Maroc',
  marox: 'Maroc',
  turguie: 'Turquie',
  espange: 'Espagne',
  spain: 'Espagne',
  jamique: 'Jamaïque',
  indie: 'Inde',
  paragauy: 'Paraguay',
  somalia: 'Somalie',
  ethiopia: 'Éthiopie',
  'ivory coast': "Côte d'Ivoire",
  tunisia: 'Tunisie',
  bulgare: 'Bulgarie',
  macedoine: 'Macédoine du Nord',
  macedonie: 'Macédoine du Nord',
  moldova: 'Moldavie',
  albania: 'Albanie',
  australia: 'Australie',
  colombia: 'Colombie',
  balkan: 'Balkans',
  'asie du sud est': 'Asie du Sud-Est',
  'el salvador': 'Salvador',
};

const BY_KEY = new Map<string, string>([
  ...COUNTRIES.map((c) => [normalizePlace(c.name), c.name] as [string, string]),
  ...Object.entries(ALIASES).map(
    ([k, v]) => [normalizePlace(k), v] as [string, string],
  ),
]);

/**
 * Turns a free-text origin cell ("Maroc, Tunisie", "Colombia/Venezuela",
 * "Haute provence") into country / region names. Unknown parts are returned
 * apart so they can be reported.
 */
export function parseOrigins(raw: unknown): {
  places: string[];
  unknown: string[];
} {
  if (raw === null || raw === undefined) return { places: [], unknown: [] };
  const places: string[] = [];
  const unknown: string[] = [];
  for (const part of String(raw).split(/[,/;]+/)) {
    const key = normalizePlace(part);
    if (
      !key ||
      key === '-' ||
      key === '?' ||
      key === 'origin' ||
      key === 'origine'
    )
      continue;
    const place = BY_KEY.get(key);
    if (place) {
      if (!places.includes(place)) places.push(place);
    } else {
      unknown.push(part.trim());
    }
  }
  return { places, unknown };
}
