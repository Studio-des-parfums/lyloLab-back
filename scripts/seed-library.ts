/**
 * Fills the olfactive library: the Société Française des Parfumeurs (SFP)
 * classification of olfactive families and the default definitions of the 24
 * facets (each team can override them from the library page).
 *
 * Idempotent: npm run seed:library
 */
import { PrismaClient } from '@prisma/client';
import { seedAdapter } from './seed-db.js';
import 'dotenv/config';

const SFP_URL =
  'https://www.sfp-parfumeurs.com/fr/filiere-parfum/les-familles-olfactives-102';

/** Families and subfamilies, names as written on the SFP page; descriptions paraphrased. */
const FAMILIES: {
  code: string;
  name: string;
  description: string;
  subfamilies: [string, string][];
}[] = [
  {
    code: 'A',
    name: 'Hespéridée',
    description:
      "Essences d'agrumes extraites des zestes (bergamote, citron, orange) associées aux produits de l'oranger ; famille des premières Eaux de Cologne.",
    subfamilies: [
      ['A1', 'Hespéridé'],
      ['A2', 'Hespéridé épicé'],
      ['A3', 'Hespéridé aromatique'],
      ['A4', 'Hespéridé fleuri chypré'],
      ['A5', 'Hespéridé boisé'],
      ['A6', 'Hespéridé fleuri boisé'],
      ['A7', 'Hespéridé musqué'],
    ],
  },
  {
    code: 'B',
    name: 'Florale',
    description:
      'Le thème principal est une fleur ou un bouquet de fleurs (jasmin, rose, muguet, violette, tubéreuse, narcisse…).',
    subfamilies: [
      ['B1', 'Soliflore'],
      ['B2', 'Fleuri musqué'],
      ['B3', 'Bouquet floral'],
      ['B4', 'Fleuri aldéhydé'],
      ['B5', 'Fleuri vert'],
      ['B6', 'Fleuri boisé fruité'],
      ['B7', 'Fleuri boisé'],
      ['B8', 'Fleuri marin'],
      ['B9', 'Fleuri fruité'],
    ],
  },
  {
    code: 'C',
    name: 'Fougère',
    description:
      "Nom de fantaisie qui n'évoque pas l'odeur de la fougère : accord généralement construit sur la lavande, les notes boisées, la mousse de chêne, la coumarine, la bergamote et le géranium.",
    subfamilies: [
      ['C1', 'Fougère'],
      ['C2', 'Fougère fleurie ambrée'],
      ['C3', 'Fougère ambrée douce'],
      ['C4', 'Fougère épicée'],
      ['C5', 'Fougère aromatique'],
      ['C6', 'Fougère fruitée'],
    ],
  },
  {
    code: 'D',
    name: 'Chypre',
    description:
      'Nom issu du parfum lancé par François Coty en 1917 ; accord basé principalement sur la mousse de chêne, le ciste-labdanum, le patchouli et la bergamote.',
    subfamilies: [
      ['D1', 'Chypre'],
      ['D2', 'Chypre fruité'],
      ['D3', 'Chypre fleuri aldéhydé'],
      ['D4', 'Chypre cuir'],
      ['D5', 'Chypre aromatique'],
      ['D6', 'Chypre vert'],
      ['D7', 'Chypre fleuri'],
    ],
  },
  {
    code: 'E',
    name: 'Boisée',
    description:
      'Notes chaudes ou opulentes (santal, patchouli) ou plus sèches (cèdre, vétiver), avec généralement une tête de lavande et de notes hespéridées.',
    subfamilies: [
      ['E1', 'Boisé'],
      ['E2', 'Boisé conifère hespéridé'],
      ['E3', 'Boisé épicé'],
      ['E4', 'Boisé ambré'],
      ['E5', 'Boisé aromatique'],
      ['E6', 'Boisé épicé cuir'],
      ['E7', 'Boisé marin'],
      ['E8', 'Boisé fruité'],
      ['E9', 'Boisé musqué'],
    ],
  },
  {
    code: 'F',
    name: 'Ambrée-orientale',
    description:
      'Notes douces, poudrées, vanillées, ciste-labdanum et notes animales ; aussi appelés « ambrés » ou « orientaux ».',
    subfamilies: [
      ['F1', 'Ambré doux'],
      ['F2', 'Ambré fleuri épicé'],
      ['F3', 'Ambré hespéridé'],
      ['F4', 'Ambré fleuri boisé'],
      ['F5', 'Florientaux'],
      ['F6', 'Ambré fleuri fruité'],
    ],
  },
  {
    code: 'G',
    name: 'Cuir',
    description:
      'Style à part, notes sèches voire très sèches qui imitent le cuir (fumée, bois brûlé, bouleau, tabac), avec parfois une tête aux inflexions florales.',
    subfamilies: [
      ['G1', 'Cuir'],
      ['G2', 'Cuir fleuri'],
      ['G3', 'Cuir tabac'],
    ],
  },
];

/**
 * Indicative facet profile deduced from the words of a family name (not part
 * of the SFP classification): used to suggest catalog materials close to it.
 */
const WORD_FACETS: [RegExp, string[]][] = [
  [/hesp[ée]rid/i, ['Fraicheur', 'Acidulé']],
  [/[ée]pic/i, ['Epicé']],
  [/aromatique/i, ['Aromatique']],
  [/fleuri|florale|floral|soliflore|bouquet|florient/i, ['Floral']],
  [/chypr/i, ['Chypré']],
  [/bois/i, ['Boisé']],
  [/musqu/i, ['Musqué']],
  [/ald[ée]hyd/i, ['Aldéhydé']],
  [/vert/i, ['Vert']],
  [/fruit/i, ['Fruité']],
  [/marin/i, ['Marin']],
  [/foug[èe]re/i, ['Aromatique', 'Poudré']],
  [/ambr|orient/i, ['Ambré', 'Balsamique']],
  [/doux|douce/i, ['Gourmand', 'Poudré']],
  [/conif[èe]re/i, ['Résineux']],
  [/cuir/i, ['Animalisé', 'Fumé']],
  [/tabac/i, ['Fumé']],
];

const facetsOf = (name: string) => [
  ...new Set(
    WORD_FACETS.flatMap(([re, facets]) => (re.test(name) ? facets : [])),
  ),
];

/** Default definitions of the 24 facets, editable by each team. */
const FACET_DEFINITIONS: Record<string, [string, string]> = {
  Acidulé: [
    'Note vive et piquante qui évoque les fruits acides et les zestes.',
    'Citron, bergamote, pamplemousse, rhubarbe',
  ],
  Sec: [
    "Sensation sans rondeur ni sucre, presque poussiéreuse, qui assèche l'accord.",
    'Vétiver, cèdre, notes de bois sec',
  ],
  Aldéhydé: [
    'Note pétillante, savonneuse ou métallique des aldéhydes aliphatiques.',
    'Aldéhydes C10, C11, C12',
  ],
  Fraicheur: [
    'Effet frais et lumineux en tête, souvent hespéridé, aromatique ou ozonique.',
    'Agrumes, menthe, notes aquatiques',
  ],
  Vert: [
    "Odeur de feuille, de tige coupée ou d'herbe fraîche.",
    'Galbanum, feuille de violette, cis-3-hexénol',
  ],
  Camphré: [
    'Note fraîche, médicinale et pénétrante.',
    'Camphre, eucalyptus, romarin',
  ],
  Aromatique: [
    'Herbes aromatiques et plantes de la garrigue.',
    'Lavande, sauge sclarée, thym, basilic',
  ],
  Epicé: [
    'Épices chaudes ou fraîches.',
    'Cannelle, girofle, poivre, cardamome, gingembre',
  ],
  Résineux: [
    'Résines et baumes de conifères, notes de sève.',
    'Encens, élémi, pin, sapin',
  ],
  Musqué: [
    'Note douce, propre et persistante des muscs.',
    'Muscs macrocycliques, ambrette',
  ],
  Ambré: [
    "Note chaude, enveloppante et sensuelle de l'accord ambré.",
    'Ciste-labdanum, vanille, benjoin',
  ],
  Poudré: [
    'Note douce et cosmétique qui évoque la poudre de riz.',
    'Iris, violette, héliotropine, coumarine',
  ],
  Chypré: [
    'Accord mousse de chêne, patchouli et bergamote caractéristique de la famille Chypre.',
    'Mousse de chêne, patchouli, labdanum',
  ],
  Gras: [
    'Note cireuse, lourde ou huileuse.',
    'Aldéhydes gras, cire, notes de beurre',
  ],
  Animalisé: [
    'Notes chaudes et charnelles qui évoquent le monde animal.',
    'Castoréum, civette, indole, cuir',
  ],
  Boisé: [
    'Odeurs de bois, sèches ou crémeuses.',
    'Santal, cèdre, vétiver, patchouli',
  ],
  Terreux: [
    'Odeur de terre humide, de racine ou de sous-bois.',
    'Vétiver, patchouli, géosmine',
  ],
  Balsamique: [
    'Note douce et résineuse des baumes.',
    'Benjoin, baume de Tolu, baume du Pérou',
  ],
  Fumé: ['Note de fumée, de bois brûlé ou de goudron.', 'Bouleau, cade, gaïac'],
  Marin: [
    'Note iodée, aquatique ou ozonique qui évoque la mer.',
    'Calone, algues, notes ozoniques',
  ],
  Floral: [
    'Odeur de fleur, seule ou en bouquet.',
    'Rose, jasmin, muguet, tubéreuse',
  ],
  Gourmand: [
    'Note sucrée et comestible.',
    'Vanille, caramel, praliné, éthyl maltol',
  ],
  Lacté: [
    'Note crémeuse et lactée.',
    'Lactones, notes de lait de figue, santal',
  ],
  Fruité: [
    'Odeur de fruits frais ou confits.',
    'Pêche, cassis, pomme, poire, framboise',
  ],
};

async function main() {
  const prisma = new PrismaClient({
    adapter: seedAdapter(),
  });

  let position = 0;
  for (const family of FAMILIES) {
    const rows = [
      {
        code: family.code,
        name: family.name,
        parentCode: null,
        description: family.description,
      },
      ...family.subfamilies.map(([code, name]) => ({
        code,
        name,
        parentCode: family.code,
        description: null,
      })),
    ];
    for (const row of rows) {
      const data = {
        ...row,
        facets: facetsOf(row.name),
        sourceUrl: SFP_URL,
        position: position++,
      };
      await prisma.olfactiveFamily.upsert({
        where: { code: row.code },
        create: data,
        update: data,
      });
    }
  }

  for (const [facet, [description, examples]] of Object.entries(
    FACET_DEFINITIONS,
  )) {
    const existing = await prisma.facetDefinition.findFirst({
      where: { facet, teamId: null },
    });
    if (existing) {
      await prisma.facetDefinition.update({
        where: { id: existing.id },
        data: { description, examples },
      });
    } else {
      await prisma.facetDefinition.create({
        data: { facet, description, examples },
      });
    }
  }

  const subfamilies = FAMILIES.reduce((n, f) => n + f.subfamilies.length, 0);
  console.log(
    `${FAMILIES.length} familles, ${subfamilies} sous-familles (SFP), ${Object.keys(FACET_DEFINITIONS).length} définitions de facettes.`,
  );
  await prisma.$disconnect();
}

await main();
