/**
 * Fills the database with the official regulations: their definitions, the
 * official texts they rely on ("References tableau" sheet of the RADAR file),
 * the list of the 26 historic EU fragrance allergens, then computes the
 * material ↔ regulation link table for every team.
 *
 * Idempotent: run it again after changing a definition below.
 *   npx tsx scripts/seed-regulations.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedAdapter } from './seed-db.js';
import 'dotenv/config';
import { syncOfficialRegulations } from '../src/regulations/regulation-sync.js';

const SOURCES = [
  {
    ref: 1,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title: 'IFRA Standards — 51st Amendment (Complete Standards, Jan. 2024)',
    date: '2023 (notif. 30 juin 2023 ; implémentation oct. 2025)',
    url: 'https://d3t14p1xronwr0.cloudfront.net/docs/Standards-Documentation/ifra-standards-51st-amendment.pdf',
    usage:
      'Toutes les limites Cat. 4 (fine fragrance) pour chaque matière première. Source primaire pour toutes les colonnes « IFRA 51 – Cat. 4 » des tableaux.',
  },
  {
    ref: 2,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title: 'Index of IFRA Standards – 51st Amendment (PDF index)',
    date: '2023',
    url: 'https://d3t14p1xronwr0.cloudfront.net/docs/Standards-Documentation/ifra-51st-amendment-index-of-ifra-standards.pdf',
    usage:
      'Vérification du statut (Restriction / Prohibition / Specification) pour chaque matière. Utilisé pour identifier les matières listées vs. non listées.',
  },
  {
    ref: 3,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title: 'Guidance for the Use of IFRA Standards – 51st Amendment',
    date: '2023',
    url: 'https://ifrafragrance.org/docs/default-source/51st-amendment/ifra-51st-amendment---guidance-for-the-use-of-ifra-standards.pdf',
    usage:
      'Interprétation des catégories produit, des spécifications, et de la méthode de calcul des limites (QRA2, aggregate exposure).',
  },
  {
    ref: 4,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title: 'IFRA Standards Documentation — Page officielle',
    date: '2023',
    url: 'https://ifrafragrance.org/initiatives-positions/safe-use-fragrance-science/ifra-standards/ifra-standards-documentation',
    usage:
      'Accès aux fichiers Excel (IFRA Standards Overview + Annex on contributions from other sources). Utilisé pour les HE naturelles et contributions des composants.',
  },
  {
    ref: 5,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title:
      'Annex on contributions from other sources to IFRA Standards (Excel)',
    date: '2023',
    url: 'https://ifrafragrance.org/initiatives-positions/safe-use-fragrance-science/ifra-standards',
    usage:
      'Teneur typique en constituants restreints dans les HE naturelles (géraniol, linalol, citral, etc.). Utilisé pour les colonnes Recombi.',
  },
  {
    ref: 6,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title: 'IFRA Standards Library — Online searchable database',
    date: '2023',
    url: 'https://ifrafragrance.org/standards-library',
    usage:
      'Vérification ponctuelle des standards individuels (limites par catégorie, CAS, endpoints).',
  },
  {
    ref: 7,
    jurisdiction: 'Union Européenne',
    organisation: 'Commission Européenne / EUR-Lex',
    title: 'Regulation (EC) No 1223/2009 — EU Cosmetics Regulation (original)',
    date: '2009 (mise à jour continue)',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02009R1223-20230101',
    usage:
      'Base réglementaire pour les 26 allergènes de fragrance déclarables (Annexe III). Utilisé pour la colonne « Allergène UE déclarable ».',
  },
  {
    ref: 8,
    jurisdiction: 'Union Européenne',
    organisation: 'Commission Européenne / EUR-Lex',
    title:
      'Commission Regulation (EU) 2023/1545 — Fragrance allergen labelling (extended list)',
    date: '26 juillet 2023 (applicable 31 juillet 2026)',
    url: 'https://eur-lex.europa.eu/eli/reg/2023/1545/oj/eng',
    usage:
      'Extension de la liste EU à ~80 allergènes déclarables (dont β-caryophyllène, linalol, camphre, acétate cédryle, alcool phényléthylique, etc.). Source pour toutes les mentions « EU étendu 2023 ».',
  },
  {
    ref: 9,
    jurisdiction: 'Union Européenne',
    organisation: 'SCCS — Scientific Committee on Consumer Safety',
    title:
      'SCCS Opinion on Fragrance Allergens in Cosmetic Products (SCCS/1459/11)',
    date: '2012-06',
    url: 'https://health.ec.europa.eu/latest-updates/sccs-opinion-fragrance-allergens-cosmetic-products-2012-06-26_en',
    usage:
      'Base scientifique pour la révision de la liste EU 2023. Identifie 56 allergènes supplémentaires. Cité dans les considérants de EU 2023/1545.',
  },
  {
    ref: 10,
    jurisdiction: 'États-Unis',
    organisation: 'FDA — Food & Drug Administration',
    title:
      'Modernization of Cosmetics Regulation Act of 2022 (MoCRA) — Official FDA Page',
    date: 'Signé le 29 déc. 2022',
    url: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/cosmetics-us-law',
    usage:
      'Statut réglementaire USA pour tous les ingrédients. Source pour la colonne « USA MoCRA ». Obligation déclaration INCI sur étiquette, allergen labeling rule en cours.',
  },
  {
    ref: 11,
    jurisdiction: 'États-Unis',
    organisation: 'Congressional Research Service / Congress.gov',
    title: 'CRS Report R47826 — FDA Regulation of Cosmetics Under MoCRA',
    date: '2023',
    url: 'https://www.congress.gov/crs-product/R47826',
    usage:
      "Analyse détaillée des exigences MoCRA, notamment sur la fragrance allergen labeling rule. Règle finale non encore publiée au moment de l'analyse.",
  },
  {
    ref: 12,
    jurisdiction: 'États-Unis',
    organisation: 'National Toxicology Program (NTP) / IARC',
    title: 'NTP — Report on Carcinogens (méthyl eugénol, estragole, safrole)',
    date: 'NTP RoC 15th ed.',
    url: 'https://ntp.niehs.nih.gov/ntp/roc/content/profiles/methyleugenol.pdf',
    usage:
      'Source pour les alertes carcinogène USA (méthyl eugénol, estragole, bouleau) mentionnées dans la colonne MoCRA.',
  },
  {
    ref: 13,
    jurisdiction: 'Californie (USA)',
    organisation: 'CDPH — California Department of Public Health',
    title:
      'CFFIRKA — Cosmetic Fragrance and Flavor Ingredient Right to Know Act — CDPH Official FAQ',
    date: 'En vigueur depuis 1er janv. 2022',
    url: 'https://www.cdph.ca.gov/Programs/CCDPHP/DEODC/OHB/CSCP/Pages/Compliance-FAQ.aspx',
    usage:
      'Source officielle pour les obligations de déclaration California. Seuils : ≥ 0.001% leave-on, ≥ 0.01% rinse-off. Utilisée pour toute la colonne « Californie ».',
  },
  {
    ref: 14,
    jurisdiction: 'Californie (USA)',
    organisation: 'OEHHA — Office of Environmental Health Hazard Assessment',
    title: 'Proposition 65 Official List of Chemicals',
    date: 'Mise à jour continue',
    url: 'https://oehha.ca.gov/proposition-65/proposition-65-list',
    usage:
      'Source pour les alertes Prop 65 (estragole, méthyl eugénol, HAP dans bouleau non rectifié).',
  },
  {
    ref: 15,
    jurisdiction: 'Californie (USA)',
    organisation: 'ArentFox Schiff — Alert juridique',
    title:
      'California Greatly Expands List of Cosmetics Fragrances Reportable as Allergens',
    date: '2024-04',
    url: 'https://www.afslaw.com/perspectives/alerts/california-greatly-expands-list-cosmetics-fragrances-reportable-allergens',
    usage:
      "Confirmation que la Californie adopte la liste EU étendue 2023/1545. Source pour l'intégration des nouveaux allergènes dans la colonne Californie.",
  },
  {
    ref: 16,
    jurisdiction: 'Chine',
    organisation: 'NMPA — National Medical Products Administration',
    title: 'Cosmetics Supervision and Administration Regulations (CSAR)',
    date: 'En vigueur 1er janv. 2021',
    url: 'https://www.nmpa.gov.cn/xxgk/fgwj/flxzhfg/20201231191000116.html',
    usage:
      'Cadre réglementaire principal cosmétiques Chine. Source pour la colonne « Chine CSAR ».',
  },
  {
    ref: 17,
    jurisdiction: 'Chine',
    organisation: 'NMPA — National Medical Products Administration',
    title:
      'Inventory of Existing Cosmetic Ingredients in China 2021 (IECIC 2021)',
    date: 'Publié 30 avril 2021 ; en vigueur 1er mai 2021',
    url: 'https://www.nmpa.gov.cn/xxgk/ggtg/qtggtg/20210430174956143.html',
    usage:
      'Liste des 8 972 ingrédients autorisés en Chine. Source pour vérifier si chaque matière est « Présent IECIC 2021 » ou non.',
  },
  {
    ref: 18,
    jurisdiction: 'Chine',
    organisation: 'NMPA — National Medical Products Administration',
    title:
      'Safety and Technical Standards for Cosmetics (STSC 2015) — Annexes restrictions',
    date: '2015 (référence toujours en vigueur)',
    url: 'https://www.nmpa.gov.cn/xxgk/ggtg/qtggtg/20151223120001986.html',
    usage:
      'Source pour les restrictions spécifiques STSC (méthyl eugénol, estragole, p-crésol, thymol, etc.).',
  },
  {
    ref: 19,
    jurisdiction: 'Chine',
    organisation: 'ChemLinked Cosmetics',
    title:
      'China Cosmetic Ingredient Regulatory Updates 2021 — Synthèse CSAR/IECIC',
    date: '2021-10',
    url: 'https://cosmetic.chemlinked.com/news/cosmetic-news/china-cosmetic-ingredient-regulatory-updates-in-2021',
    usage:
      'Synthèse de la mise en œuvre CSAR/IECIC. Source complémentaire pour la colonne Chine.',
  },
  {
    ref: 20,
    jurisdiction: 'MENA / GCC',
    organisation: 'GSO — GCC Standardization Organization',
    title:
      'GSO 1943:2021 — Cosmetic Products: Safety Requirements (Standard officiel GCC)',
    date: '2021 (révision 2024 également disponible)',
    url: 'https://www.gso.org.sa/store/standards/GSO:781231/GSO%201943:2021?lang=en',
    usage:
      'Source primaire pour la colonne « MENA GSO 1943 ». La norme reprend les listes EU 1223/2009 (interdits, restreints, conservateurs, colorants, filtres UV).',
  },
  {
    ref: 21,
    jurisdiction: 'MENA / GCC',
    organisation: 'Intertek — Note réglementaire',
    title: 'UAE GSO 1943:2021 — Regulatory Update for Cosmetics exports',
    date: '2021',
    url: 'https://www.intertek.com/government/export-import/regulatory-news-updates/news-uae/uae-gso-1943-2021/',
    usage:
      "Confirmation que GSO 1943:2021 s'aligne sur EU 1223/2009. Source pour la note « GSO 1943 = EU → conforme si conforme EU ».",
  },
  {
    ref: 22,
    jurisdiction: 'MENA / GCC',
    organisation: 'ChemLinked Cosmetics',
    title: 'UAE Cosmetic Regulation — GSO Standards Overview',
    date: '2025',
    url: 'https://cosmetic.chemlinked.com/cosmepedia/united-arab-emirates-uae-cosmetic-regulation',
    usage:
      "Vérification de l'alignement GSO / EU par pays GCC (UAE, KSA, Kuwait, Oman, Bahrain).",
  },
  {
    ref: 23,
    jurisdiction: 'Référence vérification IFRA',
    organisation:
      'Fraterworks® (Nouvelle-Zélande) — Raw Materials for Perfumers',
    title:
      'Fiches produits individuelles avec limites IFRA 51 Cat. 4 confirmées',
    date: '2023–2024',
    url: 'https://fraterworks.com',
    usage:
      'Source secondaire pour limites Cat. 4 : abs bourgeon de cassis (0.4%), fir balsam abs. (25%), sandalwood India (pas de limite), ylang ylang (0.73%), sage officinale (4.117%). Fraterworks est membre IFRA officiel.',
  },
  {
    ref: 24,
    jurisdiction: 'Référence vérification IFRA',
    organisation: 'Scentspiracy® — Fragrance education platform',
    title: 'IFRA 51st Amendment explained + Ingredient profiles individuels',
    date: '2023–2025',
    url: 'https://www.scentspiracy.com/blog/ifra-51st-amendment',
    usage:
      "Source secondaire pour l'interprétation de l'Amend. 51 et profils moléculaires.",
  },
  {
    ref: 25,
    jurisdiction: 'Référence vérification IFRA',
    organisation: 'Fraterworks — Blog',
    title: 'Working with IFRA Limits — Calculation guide',
    date: 'Fév. 2023',
    url: 'https://fraterworks.com/blogs/information/working-with-ifra-limits',
    usage:
      'Méthode de calcul de conformité IFRA Cat. 4 (formule % produit fini). Utilisé pour les notes de calcul dans les colonnes Recombi.',
  },
  {
    ref: 26,
    jurisdiction: 'Base de données CAS',
    organisation: 'The Good Scents Company',
    title: 'TGSC — The Good Scents Company Fragrance Database',
    date: 'En continu',
    url: 'https://www.thegoodscentscompany.com',
    usage:
      'Vérification des CAS numbers, synonymes commerciaux, INCI names pour toutes les matières premières.',
  },
  {
    ref: 27,
    jurisdiction: 'Base de données CAS',
    organisation: 'PubChem — NCBI / NIH',
    title: 'PubChem Compound Database',
    date: 'En continu',
    url: 'https://pubchem.ncbi.nlm.nih.gov',
    usage: 'Vérification des structures chimiques et CAS numbers.',
  },
  {
    ref: 28,
    jurisdiction: 'Base de données GHS',
    organisation: 'ECHA — European Chemicals Agency',
    title: 'ECHA C&L Inventory / SVHC list (GHS classification CLP)',
    date: 'En continu',
    url: 'https://echa.europa.eu/information-on-chemicals/cl-inventory-database',
    usage:
      'Source pour les classifications GHS/CLP (sensibilisants Cat. 1, 1A, 1B) dans la colonne RCIII.',
  },
  // Added November 2026.
  {
    ref: 29,
    jurisdiction: 'Canada',
    organisation: 'Santé Canada — Health Canada',
    title:
      'Industry Guide for the labelling of cosmetics (sections 8.3.8 et 8.7 : allergènes de parfum)',
    date: '2026-04-24',
    url: 'https://www.canada.ca/en/health-canada/services/consumer-product-safety/reports-publications/industry-professionals/labelling-cosmetics.html',
    usage:
      "Dates et listes des allergènes de parfum à déclarer au Canada (liste 1 : 24 ; liste 2 : 81, alignée sur l'annexe III UE).",
  },
  {
    ref: 30,
    jurisdiction: 'Canada',
    organisation: 'Santé Canada — Health Canada',
    title: 'Cosmetic Ingredient Hotlist: Prohibited and Restricted Ingredients',
    date: '2026-03-31',
    url: 'https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics/cosmetic-ingredient-hotlist-prohibited-restricted-ingredients.html',
    usage:
      'Liste canadienne des ingrédients interdits et restreints dans les cosmétiques.',
  },
  {
    ref: 31,
    jurisdiction: 'Union Européenne',
    organisation: 'Commission Européenne / EUR-Lex',
    title:
      'Commission Regulation (EU) 2025/877 — Omnibus Act VII (CMR, annexe II)',
    date: '2025 (applicable 1er septembre 2025)',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025R0877',
    usage:
      "Ajoute 21 substances CMR à l'annexe II (entrées 1731 à 1751) du règlement 1223/2009.",
  },
  {
    ref: 32,
    jurisdiction: 'Royaume-Uni',
    organisation: 'Department for Business and Trade / legislation.gov.uk',
    title:
      'The Cosmetic Products Regulation (EC) No 1223/2009 (Restriction of Chemical Substances) (Amendment and Transitional Provisions) Regulations 2026 — SI 2026/23',
    date: '12 janv. 2026 (en vigueur 15 juillet / 15 août 2026)',
    url: 'https://www.legislation.gov.uk/uksi/2026/23/contents',
    usage:
      "Interdictions en Grande-Bretagne : 4-MBC (15/07/2026) et 16 substances CMR ajoutées à l'annexe 2 (15/08/2026).",
  },
  {
    ref: 33,
    jurisdiction: 'Royaume-Uni',
    organisation: 'EUverify (note réglementaire)',
    title: 'EU & UK Fragrance Allergen Rules: What Cosmetic Brands Must Know',
    date: '2026',
    url: 'https://euverify.com/resource/eu-uk-fragrance-allergen-rules/',
    usage:
      "Source secondaire : la Grande-Bretagne reste sur la liste historique des 26 allergènes ; l'Irlande du Nord suit l'UE. À confirmer sur un texte officiel britannique.",
  },
  {
    ref: 34,
    jurisdiction: 'Corée du Sud',
    organisation: 'MFDS — Ministry of Food and Drug Safety',
    title:
      "화장품 사용 시의 주의사항 및 알레르기 유발성분 표시에 관한 규정 — avis d'amendement",
    date: '2019-09-11 (étiquetage obligatoire au 1er janv. 2020)',
    url: 'https://www.mfds.go.kr/brd/m_209/view.do?seq=43157',
    usage:
      "Base réglementaire coréenne de l'étiquetage des 25 allergènes de parfum.",
  },
  {
    ref: 35,
    jurisdiction: 'Corée du Sud',
    organisation: 'ChemLinked Cosmetics',
    title:
      'South Korea Clarifies 25 Fragrance Allergens Need to be Labeled on the Packaging',
    date: '2019-09-17',
    url: 'https://cosmetic.chemlinked.com/news/cosmetic-news/south-korea-clarifies-25-fragrance-allergens-need-be-labeled-packaging',
    usage:
      'Liste des 25 allergènes coréens et seuils (0,001 % non rincé / 0,01 % rincé). Source secondaire.',
  },
  {
    ref: 36,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title:
      'End of Consultation Letter for the 52nd Amendment to the IFRA Standards',
    date: '2026-08-31',
    url: 'https://ifrafragrance.org/latest-updates/ifra-news/ifra-publishes-end-of-consultation-letter-for-the-52nd-amendment-to-the-ifra-standards',
    usage:
      'Contenu final du 52e amendement : 48 nouvelles restrictions, 15 révisées, musc cétone, vétiver acétylé.',
  },
  {
    ref: 37,
    jurisdiction: 'IFRA',
    organisation: 'IFRA — International Fragrance Association',
    title:
      'IFRA to present the 52nd Amendment at Global Cosmetics Regulations 2026',
    date: '2026',
    url: 'https://ifrafragrance.org/latest-updates/ifra-news/ifra-52nd-amendment-global-cosmetics-regulations-2026',
    usage:
      'Calendrier : notification attendue en janvier 2027, puis 11 mois (nouvelles créations) et 30 mois (existantes).',
  },
  {
    ref: 38,
    jurisdiction: 'Union Européenne',
    organisation: 'Commission Européenne / EUR-Lex',
    title:
      'Commission Regulation (EU) 2023/2055 — Restriction des microparticules de polymères synthétiques (REACH annexe XVII, entrée 78)',
    date: '2023 (en vigueur 17 oct. 2023)',
    url: 'https://eur-lex.europa.eu/eli/reg/2023/2055/oj',
    usage:
      "Interdiction des microplastiques ajoutés intentionnellement, dont l'encapsulation des parfums à partir du 17 octobre 2029.",
  },
  {
    ref: 39,
    jurisdiction: 'Union Européenne',
    organisation: 'TÜV SÜD (note réglementaire)',
    title: 'EU REACH Annex XVII restriction on microplastics was published',
    date: '2023',
    url: 'https://www.tuvsud.com/en-us/e-ssentials-newsletter/consumer-products-and-retail-essentials/e-ssentials-8-2023/eu-reach-annex-xvii-restriction-on-microplastics-was-published',
    usage:
      "Synthèse des échéances, dont l'encapsulation des parfums (17/10/2029).",
  },
];

const WORLD = { continent: 'International', country: 'Monde' };
const EU = { continent: 'Europe', country: 'Union européenne' };
const USA = { continent: 'Amérique du Nord', country: 'États-Unis' };

const REGULATIONS: {
  code: string;
  name: string;
  description: string;
  continent: string;
  country: string;
  effectiveFrom?: Date;
  status?: 'in_force' | 'upcoming' | 'proposal';
  substanceRule?: 'declare' | 'ban';
  sources: number[];
}[] = [
  {
    code: 'ifra-cat4',
    name: 'IFRA — Catégorie 4',
    description:
      'Limites de concentration IFRA (51e amendement) pour les parfums fins (Cat.4), et matières interdites.',
    ...WORLD,
    sources: [1, 2, 3, 4, 5, 6, 23, 24, 25],
  },
  {
    code: 'eu-annex-ii',
    name: 'Règlement cosmétique UE — Annexe II',
    description:
      'Substances interdites dans les produits cosmétiques (règlement (CE) n° 1223/2009).',
    ...EU,
    sources: [7],
  },
  {
    code: 'eu-annex-iii',
    name: 'Règlement cosmétique UE — Annexe III',
    description:
      "Substances soumises à restrictions (concentration, conditions d'emploi, étiquetage).",
    ...EU,
    sources: [7],
  },
  {
    code: 'eu-allergens-26',
    name: 'Allergènes UE — 26 historiques',
    description:
      "Les 26 allergènes de parfum de l'annexe III du règlement (CE) n° 1223/2009, à déclarer sur l'étiquette au-delà de 0,001 % (produits non rincés) ou 0,01 % (produits rincés).",
    ...EU,
    sources: [7, 9],
  },
  {
    code: 'eu-allergens-2023-1545',
    name: 'Allergènes UE — liste étendue 2023/1545',
    description:
      "57 allergènes de parfum ajoutés à l'annexe III par le règlement (UE) 2023/1545, à déclarer au-delà de 0,001 % (non rincé) ou 0,01 % (rincé) pour les produits mis sur le marché à partir du 31 juillet 2026 (31 juillet 2028 pour les produits déjà en vente).",
    ...EU,
    effectiveFrom: new Date('2026-07-31'),
    sources: [8, 9, 15],
  },
  {
    code: 'ghs',
    name: 'Classification CLP / GHS',
    description: 'Classes de danger des matières selon le règlement CLP / SGH.',
    ...EU,
    sources: [28],
  },
  {
    code: 'eu-flavourings',
    name: 'Arômes alimentaires — substances restreintes',
    description:
      'Règlement (CE) n° 1334/2008, annexe III : méthyleugénol, safrole, coumarine, estragole… (colonne « Restriction flavor » du fichier de rangement).',
    ...EU,
    sources: [],
  },
  {
    code: 'usa-mocra',
    name: 'États-Unis — MoCRA',
    description:
      'Modernization of Cosmetics Regulation Act : substances restreintes.',
    ...USA,
    sources: [10, 11, 12],
  },
  {
    code: 'california',
    name: 'Californie — Prop 65 / CFFIRKA',
    description:
      'Avertissement Proposition 65, déclaration CFFIRKA et substances interdites.',
    ...USA,
    sources: [13, 14, 15],
  },
  {
    code: 'china-csar',
    name: 'Chine — CSAR / IECIC',
    description:
      'Inventaire IECIC 2021 : substances restreintes (STSC) ou interdites.',
    continent: 'Asie',
    country: 'Chine',
    sources: [16, 17, 18, 19],
  },
  {
    code: 'mena-gso',
    name: 'Pays du Golfe — GSO 1943',
    description:
      'Norme GSO 1943 : allergènes à déclarer et substances interdites.',
    continent: 'Moyen-Orient',
    country: 'Pays du Golfe (CCG)',
    sources: [20, 21, 22],
  },
  {
    code: 'eu-omnibus-vii',
    name: 'Règlement cosmétique UE — Omnibus VII (CMR)',
    description:
      "21 substances classées CMR ajoutées à l'annexe II (interdites) par le règlement (UE) 2025/877, entrées 1731 à 1751. Applicable depuis le 1er septembre 2025.",
    ...EU,
    substanceRule: 'ban',
    sources: [31, 7],
  },
  {
    code: 'eu-microplastics',
    name: 'REACH — Microplastiques (encapsulation des parfums)',
    description:
      'Règlement (UE) 2023/2055 : les microparticules de polymères synthétiques utilisées pour encapsuler les parfums sont interdites à partir du 17 octobre 2029. Concerne les formats (microcapsules), pas les matières premières.',
    ...EU,
    status: 'upcoming',
    effectiveFrom: new Date('2029-10-17'),
    sources: [38, 39],
  },
  {
    code: 'ifra-52',
    name: 'IFRA — 52e amendement',
    description:
      "48 nouvelles restrictions (sensibilisation cutanée), 15 révisées, musc cétone, vétiver acétylé, phototoxicité. Notification attendue en janvier 2027 ; s'appliquera 11 mois après (nouvelles créations) et 30 mois après (créations existantes). L'IFRA 51 reste la référence d'ici là.",
    ...WORLD,
    status: 'upcoming',
    sources: [36, 37],
  },
  {
    code: 'canada-allergens-24',
    name: 'Canada — Allergènes de parfum (liste 1, 24)',
    description:
      '24 allergènes de parfum à déclarer dans la liste des ingrédients, hors du terme « parfum », au-delà de 0,001 % (non rincé) ou 0,01 % (rincé). Obligatoire pour tous les produits depuis le 12 avril 2026.',
    continent: 'Amérique du Nord',
    country: 'Canada',
    substanceRule: 'declare',
    sources: [29, 30],
  },
  {
    code: 'canada-allergens-81',
    name: 'Canada — Allergènes de parfum (liste 2, 81)',
    description:
      "Liste alignée sur l'annexe III de l'UE (81 allergènes). Obligatoire pour les nouveaux produits depuis le 1er août 2026, et pour les produits existants à partir du 1er août 2028.",
    continent: 'Amérique du Nord',
    country: 'Canada',
    substanceRule: 'declare',
    sources: [29, 8],
  },
  {
    code: 'korea-allergens-25',
    name: 'Corée du Sud — Allergènes de parfum (25)',
    description:
      "25 allergènes de parfum à indiquer sur l'emballage au-delà de 0,001 % (non rincé) ou 0,01 % (rincé), depuis le 1er janvier 2020. Le HICC (Lyral) y est interdit.",
    continent: 'Asie',
    country: 'Corée du Sud',
    substanceRule: 'declare',
    sources: [34, 35],
  },
  {
    code: 'uk-allergens-26',
    name: 'Royaume-Uni — Allergènes de parfum (26)',
    description:
      "La Grande-Bretagne applique encore la liste historique des 26 allergènes (l'Irlande du Nord suit l'UE). Point à confirmer sur un texte officiel britannique.",
    continent: 'Europe',
    country: 'Royaume-Uni',
    substanceRule: 'declare',
    sources: [33],
  },
  {
    code: 'uk-si-2026-23',
    name: 'Royaume-Uni — Interdictions SI 2026/23',
    description:
      "Interdit le 4-MBC (3-(4'-méthylbenzylidène) camphre) depuis le 15 juillet 2026 et 16 substances CMR ajoutées à l'annexe 2 depuis le 15 août 2026 (Angleterre, Pays de Galles, Écosse).",
    continent: 'Europe',
    country: 'Royaume-Uni',
    substanceRule: 'ban',
    sources: [32],
  },
  {
    code: 'to-check',
    name: 'Statuts à vérifier',
    description:
      'Matières dont au moins un statut réglementaire reste à confirmer.',
    ...WORLD,
    sources: [26, 27],
  },
];

/**
 * The 26 fragrance allergens of Annex III of Regulation (EC) No 1223/2009
 * (entries 67 to 92). Names match the canonical names used in
 * materials' regulatory.allergens (see scripts/regulatory_mappings.py).
 */
const EU_ALLERGENS_26: {
  name: string;
  casNumber: string;
  aliases?: string[];
}[] = [
  { name: 'Amyl cinnamal', casNumber: '122-40-7' },
  { name: 'Benzyl alcohol', casNumber: '100-51-6' },
  { name: 'Cinnamyl alcohol', casNumber: '104-54-1' },
  { name: 'Citral', casNumber: '5392-40-5' },
  { name: 'Eugenol', casNumber: '97-53-0' },
  { name: 'Hydroxycitronellal', casNumber: '107-75-5' },
  { name: 'Isoeugenol', casNumber: '97-54-1' },
  { name: 'Amylcinnamyl alcohol', casNumber: '101-85-9' },
  { name: 'Benzyl salicylate', casNumber: '118-58-1' },
  { name: 'Cinnamal', casNumber: '104-55-2', aliases: ['Cinnamaldehyde'] },
  { name: 'Coumarin', casNumber: '91-64-5' },
  { name: 'Geraniol', casNumber: '106-24-1' },
  {
    name: 'Hydroxyisohexyl 3-cyclohexene carboxaldehyde',
    casNumber: '31906-04-4',
    aliases: ['Lyral', 'HICC'],
  },
  { name: 'Anise alcohol', casNumber: '105-13-5', aliases: ['Anisyl alcohol'] },
  { name: 'Benzyl cinnamate', casNumber: '103-41-3' },
  { name: 'Farnesol', casNumber: '4602-84-0' },
  {
    name: 'Butylphenyl methylpropional',
    casNumber: '80-54-6',
    aliases: ['Lilial'],
  },
  { name: 'Linalool', casNumber: '78-70-6' },
  { name: 'Benzyl benzoate', casNumber: '120-51-4' },
  { name: 'Citronellol', casNumber: '106-22-9 / 26489-01-0' },
  { name: 'Hexyl cinnamal', casNumber: '101-86-0' },
  {
    name: 'Limonene',
    casNumber: '5989-27-5 / 138-86-3 / 7705-14-8',
    aliases: ['d-Limonene', 'Dipentene'],
  },
  { name: 'Methyl 2-octynoate', casNumber: '111-12-6' },
  { name: 'alpha-Isomethyl ionone', casNumber: '127-51-5' },
  {
    name: 'Evernia prunastri extract',
    casNumber: '90028-68-5',
    aliases: ['Oakmoss extract', 'Oakmoss'],
  },
  {
    name: 'Evernia furfuracea extract',
    casNumber: '90028-67-4',
    aliases: ['Treemoss extract', 'Treemoss'],
  },
];

/**
 * The 57 fragrance allergens added to Annex III of Regulation (EC) No 1223/2009
 * by Regulation (EU) 2023/1545 (Annex III entry number in `entry`). Read from
 * the official text on EUR-Lex (CELEX 32023R1545); names are the INCI names.
 */
const EU_ALLERGENS_2023_1545: {
  entry: string;
  name: string;
  casNumber: string;
  aliases: string[];
}[] = [
  {
    entry: '46',
    name: '6-Methyl Coumarin',
    casNumber: '92-48-8',
    aliases: ['6-Methylcoumarin'],
  },
  {
    entry: '109',
    name: 'Pinus Mugo Leaf Oil',
    casNumber: '90082-72-7',
    aliases: [
      'Pinus Mugo Twig Leaf Extract',
      'Pinus Mugo Twig Oil',
      'Pinus mugo oil',
    ],
  },
  {
    entry: '114',
    name: 'Pinus Pumila Needle Extract',
    casNumber: '97676-05-6',
    aliases: ['Pinus Pumila Twig Leaf Extract', 'Pinus Pumila Twig Leaf Oil'],
  },
  {
    entry: '122',
    name: 'Cedrus Atlantica Wood Oil',
    casNumber: '92201-55-3 / 8023-85-6',
    aliases: [
      'Cedrus Atlantica Bark Extract',
      'Cedrus Atlantica Bark Oil',
      'Cedrus Atlantica Bark Water',
      'Cedrus Atlantica Leaf Extract',
      'Cedrus Atlantica Wood Extract',
      'Atlas cedarwood oil',
      'Cèdre Atlas',
    ],
  },
  {
    entry: '124',
    name: 'Turpentine',
    casNumber: '9005-90-7 / 8006-64-2 / 8052-14-0',
    aliases: ['Turpentine oil', 'Térébenthine'],
  },
  { entry: '131', name: 'Alpha-Terpinene', casNumber: '99-86-5', aliases: [] },
  { entry: '133', name: 'Terpinolene', casNumber: '586-62-9', aliases: [] },
  {
    entry: '154',
    name: 'Myroxylon Pereirae Resin',
    casNumber: '8007-00-9',
    aliases: [
      'Myroxylon Balsamum Pereirae Balsam Extract',
      'Myroxylon Balsamum Pereirae Balsam Oil',
      'Myroxylon Pereirae Oil',
      'Myroxylon Pereirae Resin Extract',
      'Balsam Peru',
      'Peru balsam',
      'Baume du Pérou',
    ],
  },
  {
    entry: '157',
    name: 'Rose Ketones',
    casNumber:
      '43052-87-5 / 23726-94-5 / 24720-09-0 / 23696-85-7 / 57378-68-4 / 71048-82-3 / 23726-92-3 / 23726-91-2',
    aliases: [
      'Alpha-Damascone',
      'cis-Rose ketone 1',
      'trans-Rose ketone 1',
      'Rose ketone 4',
      'Damascone',
      'Damascenone',
      'Rose ketone 3',
      'delta-Damascone',
      'trans-Rose ketone 3',
      'cis-Rose ketone 2',
      'cis-beta-Damascone',
      'trans-Rose ketone 2',
      'trans-beta-Damascone',
      'beta-Damascone',
    ],
  },
  {
    entry: '175',
    name: '3-Propylidenephthalide',
    casNumber: '17369-59-4',
    aliases: [],
  },
  {
    entry: '196',
    name: 'Lippia Citriodora Absolute',
    casNumber: '8024-12-2 / 85116-63-8',
    aliases: ['Verbena absolute', 'Verveine absolue'],
  },
  {
    entry: '324',
    name: 'Methyl Salicylate',
    casNumber: '119-36-8',
    aliases: [],
  },
  {
    entry: '327',
    name: 'Acetyl Cedrene',
    casNumber: '32388-55-9',
    aliases: ['Methyl cedryl ketone', 'Vertofix'],
  },
  {
    entry: '328',
    name: 'Amyl Salicylate',
    casNumber: '2050-08-0',
    aliases: [],
  },
  {
    entry: '329',
    name: 'Anethole',
    casNumber: '104-46-1 / 4180-23-8',
    aliases: ['trans-Anethole'],
  },
  { entry: '330', name: 'Benzaldehyde', casNumber: '100-52-7', aliases: [] },
  {
    entry: '331',
    name: 'Camphor',
    casNumber: '76-22-2 / 21368-68-3 / 464-49-3 / 464-48-2',
    aliases: ['Camphre'],
  },
  {
    entry: '332',
    name: 'Beta-Caryophyllene',
    casNumber: '87-44-5',
    aliases: ['Caryophyllene'],
  },
  {
    entry: '333',
    name: 'Carvone',
    casNumber: '99-49-0 / 6485-40-1 / 2244-16-8',
    aliases: ['d-Carvone', 'l-Carvone'],
  },
  {
    entry: '334',
    name: 'Dimethyl Phenethyl Acetate',
    casNumber: '151-05-3',
    aliases: ['Dimethylbenzyl Carbinyl Acetate'],
  },
  {
    entry: '335',
    name: 'Hexadecanolactone',
    casNumber: '109-29-5',
    aliases: [],
  },
  {
    entry: '336',
    name: 'Hexamethylindanopyran',
    casNumber: '1222-05-5',
    aliases: ['Galaxolide'],
  },
  { entry: '337', name: 'Linalyl Acetate', casNumber: '115-95-7', aliases: [] },
  {
    entry: '338',
    name: 'Menthol',
    casNumber: '89-78-1 / 1490-04-6 / 2216-51-5 / 15356-60-2',
    aliases: [],
  },
  {
    entry: '339',
    name: 'Trimethylcyclopentenyl Methylisopentenol',
    casNumber: '67801-20-1',
    aliases: [],
  },
  { entry: '340', name: 'Salicylaldehyde', casNumber: '90-02-8', aliases: [] },
  {
    entry: '341',
    name: 'Santalol',
    casNumber: '11031-45-1 / 115-71-9 / 77-42-9',
    aliases: ['alpha-Santalol', 'beta-Santalol'],
  },
  { entry: '342', name: 'Sclareol', casNumber: '515-03-7', aliases: [] },
  {
    entry: '343',
    name: 'Terpineol',
    casNumber: '8000-41-7 / 98-55-5 / 138-87-4 / 586-81-2',
    aliases: ['alpha-Terpineol'],
  },
  {
    entry: '344',
    name: 'Tetramethyl Acetyloctahydronaphthalenes',
    casNumber: '54464-57-2 / 54464-59-4 / 68155-66-8 / 68155-67-9',
    aliases: ['Iso E Super'],
  },
  {
    entry: '345',
    name: 'Trimethylbenzenepropanol',
    casNumber: '103694-68-4',
    aliases: [],
  },
  {
    entry: '346',
    name: 'Vanillin',
    casNumber: '121-33-5',
    aliases: ['Vanilline'],
  },
  {
    entry: '347',
    name: 'Cananga Odorata Flower Oil',
    casNumber: '83863-30-3 / 8006-81-3 / 68606-83-7 / 93686-30-7',
    aliases: ['Cananga Odorata Flower Extract', 'Ylang Ylang oil'],
  },
  {
    entry: '348',
    name: 'Cinnamomum Cassia Leaf Oil',
    casNumber: '8007-80-5 / 84961-46-6',
    aliases: [],
  },
  {
    entry: '349',
    name: 'Cinnamomum Zeylanicum Bark Oil',
    casNumber: '8015-91-6 / 84649-98-9',
    aliases: ['Cinnamon bark oil'],
  },
  {
    entry: '350',
    name: 'Citrus Aurantium Amara Flower Oil',
    casNumber: '72968-50-4',
    aliases: ['Neroli oil'],
  },
  {
    entry: '351',
    name: 'Citrus Aurantium Amara Peel Oil',
    casNumber: '68916-04-1 / 72968-50-4',
    aliases: ['Bitter orange oil'],
  },
  {
    entry: '352',
    name: 'Citrus Aurantium Bergamia Peel Oil',
    casNumber: '8007-75-8 / 89957-91-5 / 68648-33-9 / 85049-52-1',
    aliases: ['Bergamot oil'],
  },
  {
    entry: '353',
    name: 'Citrus Limon Peel Oil',
    casNumber: '84929-31-7 / 8008-56-8',
    aliases: ['Lemon oil'],
  },
  {
    entry: '354',
    name: 'Cymbopogon Schoenanthus Oil',
    casNumber: '8007-02-1 / 89998-16-3',
    aliases: ['Lemongrass oil'],
  },
  {
    entry: '355',
    name: 'Eucalyptus Globulus Leaf Oil',
    casNumber: '97926-40-4 / 8000-48-4',
    aliases: ['Eucalyptus oil'],
  },
  {
    entry: '356',
    name: 'Eugenia Caryophyllus Leaf Oil',
    casNumber: '8000-34-8 / 8015-97-2 / 84961-50-2',
    aliases: ['Clove oil'],
  },
  {
    entry: '357',
    name: 'Jasminum Grandiflorum Flower Extract',
    casNumber: '84776-64-7 / 90045-94-6 / 8022-96-6 / 8024-43-9',
    aliases: [
      'Jasminum Officinale Oil',
      'Jasminum Officinale Flower Extract',
      'Jasmine absolute',
    ],
  },
  {
    entry: '358',
    name: 'Juniperus Virginiana Oil',
    casNumber: '8000-27-9 / 85085-41-2',
    aliases: ['Juniperus Virginiana Wood Oil', 'Virginia cedarwood oil'],
  },
  {
    entry: '359',
    name: 'Laurus Nobilis Leaf Oil',
    casNumber: '8002-41-3 / 8007-48-5 / 84603-73-6',
    aliases: ['Bay laurel oil'],
  },
  {
    entry: '360',
    name: 'Lavandula Hybrida Oil',
    casNumber: '91722-69-9 / 8022-15-9 / 93455-96-0 / 93455-97-1 / 92623-76-2',
    aliases: [
      'Lavandula Hybrida Extract',
      'Lavandula Hybrida Flower Extract',
      'Lavandin oil',
    ],
  },
  {
    entry: '361',
    name: 'Mentha Piperita Oil',
    casNumber: '8006-90-4 / 84082-70-2',
    aliases: ['Peppermint oil'],
  },
  {
    entry: '362',
    name: 'Mentha Viridis Leaf Oil',
    casNumber: '8008-79-5 / 84696-51-5',
    aliases: ['Spearmint oil'],
  },
  {
    entry: '363',
    name: 'Narcissus Poeticus Extract',
    casNumber: '90064-26-9 / 68917-12-4',
    aliases: [],
  },
  {
    entry: '364',
    name: 'Pelargonium Graveolens Flower Oil',
    casNumber: '90082-51-2 / 8000-46-2',
    aliases: ['Geranium oil'],
  },
  {
    entry: '365',
    name: 'Pogostemon Cablin Oil',
    casNumber: '8014-09-3 / 84238-39-1',
    aliases: ['Patchouli oil'],
  },
  {
    entry: '366',
    name: 'Rosa Damascena Flower Oil',
    casNumber: '8007-01-0 / 90106-38-0',
    aliases: ['Rosa Damascena Flower Extract', 'Rose oil'],
  },
  {
    entry: '367',
    name: 'Santalum Album Oil',
    casNumber: '8006-87-9 / 84787-70-2',
    aliases: ['Sandalwood oil'],
  },
  { entry: '368', name: 'Eugenyl Acetate', casNumber: '93-28-7', aliases: [] },
  { entry: '369', name: 'Geranyl Acetate', casNumber: '105-87-3', aliases: [] },
  {
    entry: '370',
    name: 'Isoeugenyl Acetate',
    casNumber: '93-29-8',
    aliases: [],
  },
  {
    entry: '371',
    name: 'Pinene',
    casNumber: '80-56-8 / 7785-70-8 / 127-91-3 / 18172-67-3',
    aliases: ['alpha-Pinene', 'beta-Pinene'],
  },
];

/** Annex II entries 1731-1751 added by Regulation (EU) 2025/877, read from the official text on EUR-Lex (CELEX 32025R0877). */
const EU_OMNIBUS_VII: {
  entry: string;
  name: string;
  casNumber: string | null;
  aliases: string[];
}[] = [
  {
    entry: '1731',
    name: 'Trimethylbenzoyl Diphenylphosphine Oxide',
    casNumber: '75980-60-8',
    aliases: ['TPO', 'diphenyl(2,4,6-trimethylbenzoyl)phosphine oxide'],
  },
  {
    entry: '1732',
    name: 'Tetrabromobisphenol-A',
    casNumber: '79-94-7',
    aliases: [],
  },
  {
    entry: '1733',
    name: 'Transfluthrin',
    casNumber: '118712-89-3',
    aliases: [],
  },
  {
    entry: '1734',
    name: 'Clothianidin',
    casNumber: '210880-92-5',
    aliases: [],
  },
  {
    entry: '1735',
    name: 'Benzyl(diethylamino)diphenylphosphonium bisphenol AF salt',
    casNumber: '577705-90-9',
    aliases: [],
  },
  {
    entry: '1736',
    name: 'Benzyltriphenylphosphonium bisphenol AF salt',
    casNumber: '75768-65-9',
    aliases: [],
  },
  {
    entry: '1737',
    name: 'Reaction mass of bisphenol AF and benzyl(diethylamino)diphenylphosphonium salt',
    casNumber: null,
    aliases: [],
  },
  {
    entry: '1738',
    name: 'Reaction mass of bisphenol AF and benzyltriphenylphosphonium salt',
    casNumber: null,
    aliases: [],
  },
  {
    entry: '1739',
    name: 'Dimethyl propylphosphonate',
    casNumber: '18755-43-6',
    aliases: [],
  },
  {
    entry: '1740',
    name: 'Dibutyltin maleate',
    casNumber: '78-04-6',
    aliases: [],
  },
  {
    entry: '1741',
    name: 'Dibutyltin oxide',
    casNumber: '818-08-6',
    aliases: [],
  },
  {
    entry: '1742',
    name: 'Reaction mass of 1-(2,3-epoxypropoxy)-2,2-bis((2,3-epoxypropoxy)methyl)butane',
    casNumber: null,
    aliases: [],
  },
  { entry: '1743', name: 'Bisphenol AF', casNumber: '1478-61-1', aliases: [] },
  { entry: '1744', name: 'Benfluralin', casNumber: '1861-40-1', aliases: [] },
  {
    entry: '1745',
    name: 'N,N-dimethyl-p-toluidine',
    casNumber: '99-97-8',
    aliases: [],
  },
  {
    entry: '1746',
    name: "1,4-Benzenediamine, N,N'-mixed Ph and tolyl derivs.",
    casNumber: '68953-84-4',
    aliases: [],
  },
  {
    entry: '1747',
    name: '4-Nitrosomorpholine',
    casNumber: '59-89-2',
    aliases: [],
  },
  {
    entry: '1748',
    name: 'Difenoconazole',
    casNumber: '119446-68-3',
    aliases: [],
  },
  {
    entry: '1749',
    name: '4-Methylimidazole',
    casNumber: '822-36-6',
    aliases: [],
  },
  {
    entry: '1750',
    name: "3,3'-Dimethylbiphenyl-4,4'-diyl diisocyanate",
    casNumber: '91-97-4',
    aliases: [],
  },
  {
    entry: '1751',
    name: 'Foramsulfuron',
    casNumber: '173159-57-4',
    aliases: [],
  },
];

/** Substances prohibited in Great Britain by SI 2026/23: 4-MBC (regulation 2(2), no CAS given in the text) and the 16 Annex 2 entries 1745-1760 of the Schedule (legislation.gov.uk). */
const UK_SI_2026_23: {
  entry: string;
  name: string;
  casNumber: string | null;
  aliases: string[];
}[] = [
  {
    entry: 'Reg. 2(2)',
    name: "3-(4'-Methylbenzylidene) Camphor",
    casNumber: null,
    aliases: ['4-Methylbenzylidene Camphor', '4-MBC', 'Enzacamene'],
  },
  {
    entry: '1745',
    name: 'Trimethylbenzoyl Diphenylphosphine Oxide',
    casNumber: '75980-60-8',
    aliases: ['TPO'],
  },
  {
    entry: '1746',
    name: 'Clothianidin',
    casNumber: '210880-92-5',
    aliases: [],
  },
  {
    entry: '1747',
    name: 'Dimethyl propylphosphonate',
    casNumber: '18755-43-6',
    aliases: [],
  },
  {
    entry: '1748',
    name: 'Dibutyltin maleate',
    casNumber: '78-04-6',
    aliases: [],
  },
  {
    entry: '1749',
    name: 'Dibutyltin oxide',
    casNumber: '818-08-6',
    aliases: [],
  },
  {
    entry: '1750',
    name: 'Tetrabromobisphenol-A',
    casNumber: '79-94-7',
    aliases: [],
  },
  {
    entry: '1751',
    name: "1,4-Benzenediamine, N,N'-mixed Ph and tolyl derivs.",
    casNumber: '68953-84-4',
    aliases: [],
  },
  {
    entry: '1752',
    name: '4-Methylimidazole',
    casNumber: '822-36-6',
    aliases: [],
  },
  { entry: '1753', name: 'Acetone Oxime', casNumber: '127-06-0', aliases: [] },
  {
    entry: '1754',
    name: 'Benthiavalicarb isopropyl',
    casNumber: '177406-68-7',
    aliases: [],
  },
  {
    entry: '1755',
    name: '2,3-Epoxypropyl neodecanoate',
    casNumber: '26761-45-5',
    aliases: [],
  },
  {
    entry: '1756',
    name: 'Multi-walled carbon tubes (MWCNT)',
    casNumber: null,
    aliases: [],
  },
  {
    entry: '1757',
    name: '7-Oxabicyclo[4.1.0]hept-3-ylmethyl 7-oxabicyclo[4.1.0]heptane-3-carboxylate',
    casNumber: '2386-87-0',
    aliases: [],
  },
  {
    entry: '1758',
    name: '2-(Dimethylamino)-2-[(4-methylphenyl)methyl]-1-[4-(morpholin-4-yl)phenyl]butan-1-one',
    casNumber: '119344-86-4',
    aliases: [],
  },
  {
    entry: '1759',
    name: 'S-Metolachlor',
    casNumber: '87392-12-9',
    aliases: [],
  },
  {
    entry: '1760',
    name: 'Trimethyl borate',
    casNumber: '121-43-7',
    aliases: [],
  },
];

// Lists derived from the EU ones, by the names of the 26 historic allergens.
const HICC = 'Hydroxyisohexyl 3-cyclohexene carboxaldehyde';
const LILIAL = 'Butylphenyl methylpropional';
/** Canada list 1: the 26 minus HICC and Lilial, banned (Health Canada Industry Guide, appendix 1). */
const CANADA_LIST_1 = EU_ALLERGENS_26.filter(
  (s) => s.name !== HICC && s.name !== LILIAL,
);
/** Korea: the 26 minus HICC, banned in Korea (MFDS / ChemLinked). */
const KOREA_25 = EU_ALLERGENS_26.filter((s) => s.name !== HICC);

/**
 * Maximum peroxide values set by Annex III of Regulation (EC) No 1223/2009 as
 * worded by Regulation (EU) 2023/1545 (column i), read from the official text.
 */
const PEROXIDE_SPECS: {
  entry: string;
  substance: string;
  casNumber: string;
  aliases: string[];
  maxValue: number;
}[] = [
  {
    entry: '88',
    substance: 'Limonene',
    casNumber: '5989-27-5 / 138-86-3 / 7705-14-8',
    aliases: ['d-Limonene', 'Dipentene'],
    maxValue: 20,
  },
  {
    entry: '109',
    substance: 'Pinus Mugo Leaf Oil',
    casNumber: '90082-72-7',
    aliases: ['Pinus Mugo Twig Oil', 'Pinus mugo oil'],
    maxValue: 10,
  },
  {
    entry: '114',
    substance: 'Pinus Pumila Needle Extract',
    casNumber: '97676-05-6',
    aliases: ['Pinus Pumila Twig Leaf Oil'],
    maxValue: 10,
  },
  {
    entry: '122',
    substance: 'Cedrus Atlantica Wood Oil',
    casNumber: '92201-55-3 / 8023-85-6',
    aliases: ['Atlas cedarwood oil', 'Cèdre Atlas'],
    maxValue: 10,
  },
  {
    entry: '124',
    substance: 'Turpentine',
    casNumber: '9005-90-7 / 8006-64-2 / 8052-14-0',
    aliases: ['Turpentine oil', 'Térébenthine'],
    maxValue: 10,
  },
  {
    entry: '131',
    substance: 'Alpha-Terpinene',
    casNumber: '99-86-5',
    aliases: [],
    maxValue: 10,
  },
  {
    entry: '133',
    substance: 'Terpinolene',
    casNumber: '586-62-9',
    aliases: [],
    maxValue: 10,
  },
  {
    entry: '371',
    substance: 'Pinene',
    casNumber: '80-56-8 / 7785-70-8 / 127-91-3 / 18172-67-3',
    aliases: ['alpha-Pinene', 'beta-Pinene'],
    maxValue: 10,
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: seedAdapter(),
  });

  for (const source of SOURCES) {
    await prisma.officialSource.upsert({
      where: { ref: source.ref },
      create: source,
      update: source,
    });
  }
  const sourceIds = new Map(
    (
      await prisma.officialSource.findMany({ select: { id: true, ref: true } })
    ).map((s) => [s.ref, s.id]),
  );

  for (const { sources, ...definition } of REGULATIONS) {
    const data = {
      effectiveFrom: null,
      status: 'in_force',
      substanceRule: null,
      ...definition,
      teamId: null,
    };
    const regulation = await prisma.regulation.upsert({
      where: { code: definition.code },
      create: data,
      update: data,
    });
    await prisma.regulationSource.deleteMany({
      where: { regulationId: regulation.id },
    });
    await prisma.regulationSource.createMany({
      data: sources.map((ref) => ({
        regulationId: regulation.id,
        sourceId: sourceIds.get(ref)!,
      })),
    });
  }

  type Substance = {
    name: string;
    casNumber: string | null;
    aliases?: string[];
    note?: string | null;
  };
  const withEntry =
    (label: string) =>
    ({
      entry,
      ...s
    }: {
      entry: string;
      name: string;
      casNumber: string | null;
      aliases: string[];
    }) => ({
      ...s,
      note: `${label} ${entry}`,
    });
  const extended = EU_ALLERGENS_2023_1545.map(withEntry('Annexe III, entrée'));
  const lists: { code: string; substances: Substance[] }[] = [
    { code: 'eu-allergens-26', substances: EU_ALLERGENS_26 },
    { code: 'eu-allergens-2023-1545', substances: extended },
    {
      code: 'eu-omnibus-vii',
      substances: EU_OMNIBUS_VII.map(withEntry('Annexe II, entrée')),
    },
    {
      code: 'uk-si-2026-23',
      substances: UK_SI_2026_23.map(withEntry('SI 2026/23,')),
    },
    { code: 'canada-allergens-24', substances: CANADA_LIST_1 },
    {
      code: 'canada-allergens-81',
      substances: [...CANADA_LIST_1, ...extended],
    },
    { code: 'korea-allergens-25', substances: KOREA_25 },
    { code: 'uk-allergens-26', substances: EU_ALLERGENS_26 },
  ];
  for (const list of lists) {
    const regulation = await prisma.regulation.findUniqueOrThrow({
      where: { code: list.code },
    });
    await prisma.regulatedSubstance.deleteMany({
      where: { regulationId: regulation.id },
    });
    await prisma.regulatedSubstance.createMany({
      data: list.substances.map((s) => ({
        regulationId: regulation.id,
        name: s.name,
        casNumber: s.casNumber,
        aliases: s.aliases ?? [],
        note: s.note ?? null,
      })),
    });
  }

  for (const { entry, ...spec } of PEROXIDE_SPECS) {
    const data = {
      ...spec,
      parameter: 'peroxide_value',
      unit: 'mmol/L',
      note: `Annexe III, entrée ${entry} : indice de peroxyde inférieur à ${spec.maxValue} mmol/L.`,
      sourceRef: 8,
    };
    await prisma.stabilitySpec.upsert({
      where: {
        substance_parameter: {
          substance: spec.substance,
          parameter: 'peroxide_value',
        },
      },
      create: data,
      update: data,
    });
  }

  // Regulations removed from the list above (e.g. the old single allergen one).
  await prisma.regulation.deleteMany({
    where: { teamId: null, code: { notIn: REGULATIONS.map((r) => r.code) } },
  });
  // Sources no longer listed above.
  await prisma.officialSource.deleteMany({
    where: { ref: { notIn: SOURCES.map((s) => s.ref) } },
  });

  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
  });
  for (const team of teams) {
    const count = await syncOfficialRegulations(prisma, team.id);
    console.log(`${team.name} : ${count} liaisons matière ↔ réglementation.`);
  }
  console.log(
    `${REGULATIONS.length} réglementations, ${SOURCES.length} sources, ${EU_ALLERGENS_26.length} allergènes historiques + ${EU_ALLERGENS_2023_1545.length} ajoutés par le 2023/1545 ; listes Canada, Corée, Royaume-Uni et interdictions Omnibus VII / SI 2026/23 ; ${PEROXIDE_SPECS.length} spécifications d'indice de peroxyde.`,
  );
  await prisma.$disconnect();
}

await main();
