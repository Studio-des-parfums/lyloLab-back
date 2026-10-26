import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import type { ReasoningEffort } from 'openai/resources/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseIfraLimitPercent } from '../formulas/ifra-limit.js';
import type { ChatDto, FormulaSnapshotDto } from './dto/chat.dto.js';
import {
  ADJUSTMENTS,
  ASSISTANT_RESPONSE_SCHEMA,
  FACETS,
  resolveProposal,
  type FormulaProposal,
} from './formula-changes.js';

const DEFAULT_MODEL = 'gpt-6-astra';
const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'medium';
// Descriptors are scored 0-9 in the catalog; only the salient ones are sent.
const SALIENT_DESCRIPTOR_MIN = 4;
const MAX_DESCRIPTORS_PER_MATERIAL = 6;

const INSTRUCTIONS = `Tu es l'assistant de formulation de Lylo Lab, un laboratoire de parfumerie. Tu aides un parfumeur professionnel à construire et améliorer la formule ouverte dans l'outil.

Fonctionnement de l'outil :
- La formule est composée de matières premières « favorites » choisies dans le catalogue ci-dessous.
- 24 facettes olfactives (curseurs 0 à 100) décrivent le profil visé : ${FACETS.join(', ')}.
- 5 ajustements rapides (0 à 100) : ${ADJUSTMENTS.join(', ')}. Ils sont calculés à partir des facettes : Diffusion / Sillage = moyenne de Fraicheur, Aldéhydé, Marin, Vert, Acidulé ; Tenue = moyenne de Ambré, Boisé, Résineux, Balsamique, Musqué ; Douceur = moyenne de Gourmand, Lacté, Poudré, Floral ; Puissance = moyenne des 24 facettes ; Originalité = écart de la forme du profil par rapport au profil moyen du catalogue. Modifier un ajustement décale les facettes correspondantes.
- En répartition automatique, le moteur calcule le % de chaque matière selon son affinité avec les facettes et les ajustements, et plafonne chaque matière à sa limite IFRA Cat.4.
- En répartition manuelle, le parfumeur fixe lui-même les % de chaque matière, et les facettes deviennent le profil réel du mélange (moyenne des descripteurs pondérée par les %). Une modification de facette ou d'ajustement repasse la formule en répartition automatique.
- Les descripteurs du catalogue sont notés de 0 à 9.

Règles :
- Réponds toujours en français, de façon concise et professionnelle, en texte simple (pas de Markdown).
- Tu ne modifies jamais la formule toi-même : tu proposes des modifications dans "proposal", que le parfumeur accepte ou refuse. Mets "proposal" à null quand tu réponds simplement à une question ou quand le parfumeur ne demande pas de changement.
- Chaque proposition doit être cohérente et complète ; explique brièvement dans "message" pourquoi tu la proposes.
- N'utilise que des matières du catalogue, avec leur nom exact.
- Respecte les limites IFRA Cat.4 : ne propose jamais une matière interdite et ne dépasse jamais la limite d'une matière dans "set_percentages".
- "set_percentages" passe la formule en répartition manuelle : liste toutes les matières de la formule (après tes ajouts/retraits) avec un total de 100 %.
- Les ajouts de matières passent avant "set_percentages" dans la liste des changements.
- Signale les cumuls d'allergènes et les risques réglementaires quand c'est pertinent.
- Quand le parfumeur décrit une ambiance, une saison, une émotion ou une odeur du quotidien (par exemple « l'été », « un bonbon au cola », « le linge propre »), traduis-la en facettes olfactives et en matières du catalogue, puis propose une formule complète : matières à ajouter, facettes, ajustements et, si utile, répartition. Si la formule ouverte contient déjà des matières sans rapport, propose de les retirer.
- Quand le parfumeur cite une référence (un parfum existant, une marque, une tendance, une cible), utilise la recherche web pour retrouver sa famille olfactive et sa pyramide (notes de tête, de cœur, de fond), puis transpose-la avec les matières du catalogue. Les matières de la référence absentes du catalogue doivent être remplacées par les plus proches disponibles ; dis-le dans "message". Ne prétends jamais reproduire une formule exacte : propose une interprétation inspirée de la référence.
- Les messages du parfumeur peuvent mentionner entre crochets si une proposition précédente a été acceptée ou refusée ; tiens-en compte.`;

type CatalogMaterial = {
  id: string;
  name: string;
  family: string | null;
  sensation: string | null;
  descriptors: unknown;
  regulatory: unknown;
  stocks: { stockGrams: number | null }[];
};

function describeMaterial(material: CatalogMaterial): string {
  const parts = [material.name];
  if (material.family) parts.push(`famille: ${material.family}`);

  const descriptors = Object.entries(
    (material.descriptors ?? {}) as Record<string, number>,
  )
    .filter(([, value]) => value >= SALIENT_DESCRIPTOR_MIN)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_DESCRIPTORS_PER_MATERIAL)
    .map(([key, value]) => `${key} ${value}`);
  parts.push(descriptors.length > 0 ? `notes: ${descriptors.join(', ')}` : 'notes: profil non renseigné');

  if (material.sensation) parts.push(`odeur: ${material.sensation.slice(0, 100)}`);

  const regulatory = (material.regulatory ?? {}) as {
    ifraLimit?: string | number;
    allergens?: string[];
  };
  const limit = parseIfraLimitPercent(regulatory.ifraLimit);
  if (limit === 0) parts.push('IFRA Cat.4: INTERDITE');
  else if (limit !== null) parts.push(`IFRA Cat.4 max ${limit} %`);
  if (regulatory.allergens?.length) parts.push(`allergènes: ${regulatory.allergens.join(', ')}`);

  const grams = material.stocks
    .map((s) => s.stockGrams)
    .filter((g): g is number => g !== null)
    .reduce((sum, g) => sum + g, 0);
  if (grams > 0) parts.push(`stock: ${Math.round(grams)} g`);

  return `- ${parts.join(' | ')}`;
}

function describeFormula(formula: FormulaSnapshotDto): string {
  const lines =
    formula.lines.length > 0
      ? formula.lines
          .map(
            (line) =>
              `- ${line.material} : ${line.percent.toFixed(2)} % (${line.ml.toFixed(2)} ml)` +
              (line.ifraLimitPercent !== null && line.ifraLimitPercent !== undefined
                ? `, limite IFRA ${line.ifraLimitPercent} %${line.cappedByIfra ? ' (plafonnée)' : ''}`
                : ''),
          )
          .join('\n')
      : '(aucune matière pour le moment)';

  const facets = Object.entries(formula.facets)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
  const adjustments = Object.entries(formula.adjustments)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');

  return `État actuel de la formule (fait foi, il peut avoir changé depuis les messages précédents) :
Nom : ${formula.name}
Volume total : ${formula.totalVolumeMl} ml
Répartition : ${formula.manualDistribution ? 'manuelle' : 'automatique'}
Facettes : ${facets}
Ajustements : ${adjustments}
Matières :
${lines}
Cumuls d'allergènes : ${formula.overlappingAllergens.join(', ') || 'aucun'}`;
}

export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatResponse {
  message: string;
  proposal: FormulaProposal | null;
  warnings: string[];
  sources: ChatSource[];
}

/** Web pages the model cited while answering (deduplicated by url). */
function collectSources(response: OpenAI.Responses.Response): ChatSource[] {
  const sources = new Map<string, ChatSource>();
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type !== 'output_text') continue;
      for (const annotation of part.annotations) {
        if (annotation.type === 'url_citation' && !sources.has(annotation.url)) {
          sources.set(annotation.url, { title: annotation.title || annotation.url, url: annotation.url });
        }
      }
    }
  }
  return [...sources.values()];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getClient(): OpenAI {
    if (!process.env.OPENAI_API_KEY) {
      throw new ServiceUnavailableException(
        "L'assistant IA n'est pas configuré : ajoutez OPENAI_API_KEY dans backend/.env puis redémarrez le serveur.",
      );
    }
    this.client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return this.client;
  }

  async chat(teamId: string, dto: ChatDto): Promise<ChatResponse> {
    const client = this.getClient();

    const catalog = await this.prisma.material.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        family: true,
        sensation: true,
        descriptors: true,
        regulatory: true,
        stocks: { select: { stockGrams: true } },
      },
      orderBy: { name: 'asc' },
    });

    // The catalog sits at the start of the prompt so OpenAI's automatic
    // prompt caching can reuse it across turns; the formula state, which
    // changes every turn, goes right before the latest user message.
    const history = dto.messages.slice(0, -1);
    const latest = dto.messages[dto.messages.length - 1];

    const catalogText = catalog.map(describeMaterial).join('\n');

    let response: OpenAI.Responses.Response;
    try {
      response = await client.responses.create({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        reasoning: {
          effort:
            (process.env.OPENAI_REASONING_EFFORT as ReasoningEffort | undefined) ||
            DEFAULT_REASONING_EFFORT,
        },
        instructions: `${INSTRUCTIONS}\n\nCatalogue des matières premières :\n${catalogText}`,
        input: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'developer' as const, content: describeFormula(dto.formula) },
          { role: latest.role, content: latest.content },
        ],
        tools: process.env.OPENAI_WEB_SEARCH === 'false' ? [] : [{ type: 'web_search' }],
        text: {
          format: {
            type: 'json_schema',
            name: 'formulation_assistant_response',
            schema: ASSISTANT_RESPONSE_SCHEMA,
            strict: true,
          },
        },
      });
    } catch (err) {
      this.logger.error('OpenAI request failed', err instanceof Error ? err.stack : err);
      const detail = err instanceof OpenAI.APIError ? ` (${err.status} : ${err.message})` : '';
      throw new BadGatewayException(`L'assistant IA n'a pas pu répondre${detail}.`);
    }

    let parsed: { message: string; proposal: { summary: string; changes: never[] } | null };
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      this.logger.error(`Unparseable OpenAI output: ${response.output_text}`);
      throw new BadGatewayException("La réponse de l'assistant IA est illisible, réessayez.");
    }

    const sources = collectSources(response);
    if (!parsed.proposal) {
      return { message: parsed.message, proposal: null, warnings: [], sources };
    }

    const materialIdByName = new Map(
      catalog.map((m) => [m.name.toLowerCase(), { id: m.id, name: m.name }]),
    );
    const { proposal, warnings } = resolveProposal(parsed.proposal, materialIdByName);
    return { message: parsed.message, proposal, warnings, sources };
  }
}
