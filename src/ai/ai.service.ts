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
import { MessageFieldStream } from './message-stream.js';
import { needsWebSearch } from './web-search-intent.js';
import {
  CATALOG_TOOL,
  CATALOG_TOOL_NAME,
  searchCatalog,
} from './catalog-tool.js';

const DEFAULT_MODEL = 'gpt-6-astra';
const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'low';
// Descriptors are scored 0-9 in the catalog; only the salient ones are sent.
const SALIENT_DESCRIPTOR_MIN = 4;
const MAX_DESCRIPTORS_PER_MATERIAL = 6;
// Catalog lookups the model may chain before it must answer.
const MAX_TOOL_ROUNDS = 3;

const INSTRUCTIONS = `Tu es l'assistant de formulation de Lylo Lab, un laboratoire de parfumerie. Tu aides un parfumeur professionnel à construire et améliorer la formule ouverte dans l'outil.

Fonctionnement de l'outil :
- La formule est composée de matières premières « favorites » choisies dans le catalogue de l'équipe, que tu consultes avec l'outil consulter_catalogue.
- 24 facettes olfactives (curseurs 0 à 100) décrivent le profil visé : ${FACETS.join(', ')}.
- 5 ajustements rapides (0 à 100) : ${ADJUSTMENTS.join(', ')}. Ils sont calculés à partir des facettes : Diffusion / Sillage = moyenne de Fraicheur, Aldéhydé, Marin, Vert, Acidulé ; Tenue = moyenne de Ambré, Boisé, Résineux, Balsamique, Musqué ; Douceur = moyenne de Gourmand, Lacté, Poudré, Floral ; Puissance = moyenne des 24 facettes ; Originalité = écart de la forme du profil par rapport au profil moyen du catalogue. Modifier un ajustement décale les facettes correspondantes.
- En répartition automatique, le moteur calcule le % de chaque matière selon son affinité avec les facettes et les ajustements, et plafonne chaque matière à sa limite IFRA Cat.4.
- En répartition manuelle, le parfumeur fixe lui-même les % de chaque matière, et les facettes deviennent le profil réel du mélange (moyenne des descripteurs pondérée par les %). Une modification de facette ou d'ajustement repasse la formule en répartition automatique.
- Les descripteurs du catalogue sont notés de 0 à 9.

Règles :
- Réponds toujours en français, en texte simple (pas de Markdown), de façon professionnelle et la plus brève possible : une phrase suffit pour une salutation, un remerciement ou une question simple ; quelques phrases au maximum pour expliquer une proposition. Pas de formules de politesse superflues, pas de listes d'options non demandées.
- Tu ne modifies jamais la formule toi-même : tu proposes des modifications dans "proposal", que le parfumeur accepte ou refuse. Mets "proposal" à null quand tu réponds simplement à une question ou quand le parfumeur ne demande pas de changement.
- Chaque proposition doit être cohérente et complète ; explique brièvement dans "message" pourquoi tu la proposes.
- N'utilise que des matières du catalogue, avec leur nom exact. Ne consulte le catalogue que si tu dois suggérer, ajouter ou remplacer des matières ; pour une salutation, une question ou un réglage de facettes, réponds directement. Cible la recherche (facettes, mots-clés) plutôt que de demander tout le catalogue.
- Respecte les limites IFRA Cat.4 : ne propose jamais une matière interdite et ne dépasse jamais la limite d'une matière dans "set_percentages".
- "set_percentages" passe la formule en répartition manuelle : liste toutes les matières de la formule (après tes ajouts/retraits) avec un total de 100 %.
- Les ajouts de matières passent avant "set_percentages" dans la liste des changements.
- Signale les cumuls d'allergènes et les risques réglementaires quand c'est pertinent.
- Quand le parfumeur décrit une ambiance, une saison, une émotion ou une odeur du quotidien (par exemple « l'été », « un bonbon au cola », « le linge propre »), traduis-la en facettes olfactives et en matières du catalogue, puis propose une formule complète : matières à ajouter, facettes, ajustements et, si utile, répartition. Si la formule ouverte contient déjà des matières sans rapport, propose de les retirer.
- Quand le parfumeur cite une référence (un parfum existant, une marque, une tendance, une cible), utilise la recherche web (quand elle t'est proposée ; sinon, appuie-toi sur tes connaissances) pour retrouver sa famille olfactive et sa pyramide (notes de tête, de cœur, de fond), puis transpose-la avec les matières du catalogue. Les matières de la référence absentes du catalogue doivent être remplacées par les plus proches disponibles ; dis-le dans "message". Ne prétends jamais reproduire une formule exacte : propose une interprétation inspirée de la référence.
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
  parts.push(
    descriptors.length > 0
      ? `notes: ${descriptors.join(', ')}`
      : 'notes: profil non renseigné',
  );

  if (material.sensation)
    parts.push(`odeur: ${material.sensation.slice(0, 100)}`);

  const regulatory = (material.regulatory ?? {}) as {
    ifraLimit?: string | number;
    allergens?: string[];
  };
  const limit = parseIfraLimitPercent(regulatory.ifraLimit);
  if (limit === 0) parts.push('IFRA Cat.4: INTERDITE');
  else if (limit !== null) parts.push(`IFRA Cat.4 max ${limit} %`);
  if (regulatory.allergens?.length)
    parts.push(`allergènes: ${regulatory.allergens.join(', ')}`);

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
              (line.ifraLimitPercent !== null &&
              line.ifraLimitPercent !== undefined
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

const nullable = (type: string) => ({ type: [type, 'null'] });
const stringList = { type: 'array', items: { type: 'string' } };

const REFERENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'brand',
    'year',
    'perfumer',
    'familyCode',
    'description',
    'topNotes',
    'heartNotes',
    'baseNotes',
    'interpretation',
  ],
  properties: {
    name: { type: 'string' },
    brand: nullable('string'),
    year: nullable('integer'),
    perfumer: nullable('string'),
    familyCode: {
      ...nullable('string'),
      description: 'Code SFP, ex. D1 ou B3',
    },
    description: nullable('string'),
    topNotes: stringList,
    heartNotes: stringList,
    baseNotes: stringList,
    interpretation: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['material', 'role', 'evokes'],
        properties: {
          material: { type: 'string', description: 'Nom exact du catalogue' },
          role: { type: 'string', enum: ['tête', 'cœur', 'fond'] },
          evokes: {
            type: 'string',
            description: 'Note de la référence évoquée',
          },
        },
      },
    },
  },
};

export interface ReferenceAnalysis {
  name: string;
  brand: string | null;
  year: number | null;
  perfumer: string | null;
  familyCode: string | null;
  description: string | null;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  sources: ChatSource[];
  interpretation: {
    materialId: string;
    material: string;
    role: string;
    evokes: string;
  }[];
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

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'status'; status: 'search' | 'catalog' }
  | ({ type: 'done' } & ChatResponse)
  | { type: 'error'; message: string };

/** Web pages the model cited while answering (deduplicated by url). */
function collectSources(response: OpenAI.Responses.Response): ChatSource[] {
  const sources = new Map<string, ChatSource>();
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type !== 'output_text') continue;
      for (const annotation of part.annotations) {
        if (
          annotation.type === 'url_citation' &&
          !sources.has(annotation.url)
        ) {
          sources.set(annotation.url, {
            title: annotation.title || annotation.url,
            url: annotation.url,
          });
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

  private async buildRequest(teamId: string, dto: ChatDto) {
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

    // The catalog is not sent up front: the model fetches the materials it
    // needs through the catalog tool. The formula state, which changes every
    // turn, goes right before the latest user message.
    const history = dto.messages.slice(0, -1);
    const latest = dto.messages[dto.messages.length - 1];

    const params = {
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      reasoning: {
        effort:
          (process.env.OPENAI_REASONING_EFFORT as
            ReasoningEffort | undefined) || DEFAULT_REASONING_EFFORT,
      },
      instructions: INSTRUCTIONS,
      input: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'developer' as const, content: describeFormula(dto.formula) },
        { role: latest.role, content: latest.content },
      ] as OpenAI.Responses.ResponseInput,
      // Web search is slow: only offered when the user refers to an outside
      // reference (an existing perfume, a brand, a trend…).
      tools: [
        CATALOG_TOOL,
        ...(process.env.OPENAI_WEB_SEARCH !== 'false' &&
        needsWebSearch(latest.content)
          ? [{ type: 'web_search' as const }]
          : []),
      ] as OpenAI.Responses.Tool[],
      text: {
        format: {
          type: 'json_schema' as const,
          name: 'formulation_assistant_response',
          schema: ASSISTANT_RESPONSE_SCHEMA,
          strict: true,
        },
        verbosity: 'low' as const,
      },
    } satisfies OpenAI.Responses.ResponseCreateParamsNonStreaming;

    return { params, catalog };
  }

  private runCatalogTool(
    catalog: CatalogMaterial[],
    rawArguments: string,
  ): string {
    let args: { facettes?: string[] | null; mots_cles?: string[] | null } = {};
    try {
      args = JSON.parse(rawArguments || '{}');
    } catch {
      /* invalid arguments: fall back to the whole catalog */
    }
    const materials = searchCatalog(catalog, args, SALIENT_DESCRIPTOR_MIN);
    if (materials.length === 0)
      return 'Aucune matière trouvée pour ces critères.';
    return materials.map(describeMaterial).join('\n');
  }

  private requestError(err: unknown): BadGatewayException {
    this.logger.error(
      'OpenAI request failed',
      err instanceof Error ? err.stack : err,
    );
    const detail =
      err instanceof OpenAI.APIError ? ` (${err.status} : ${err.message})` : '';
    return new BadGatewayException(
      `L'assistant IA n'a pas pu répondre${detail}.`,
    );
  }

  private finalize(
    response: OpenAI.Responses.Response,
    catalog: CatalogMaterial[],
    outputText = response.output_text,
  ): ChatResponse {
    let parsed: {
      message: string;
      proposal: { summary: string; changes: never[] } | null;
    };
    try {
      parsed = JSON.parse(outputText);
    } catch {
      this.logger.error(`Unparseable OpenAI output: ${outputText}`);
      throw new BadGatewayException(
        "La réponse de l'assistant IA est illisible, réessayez.",
      );
    }

    const sources = collectSources(response);
    if (!parsed.proposal) {
      return { message: parsed.message, proposal: null, warnings: [], sources };
    }

    const materialIdByName = new Map(
      catalog.map((m) => [m.name.toLowerCase(), { id: m.id, name: m.name }]),
    );
    const { proposal, warnings } = resolveProposal(
      parsed.proposal,
      materialIdByName,
    );
    return { message: parsed.message, proposal, warnings, sources };
  }

  /**
   * Researches a reference perfume on the web and transposes it with the
   * team's catalog. Returns a draft the perfumer reviews before saving.
   */
  async analyzeReference(
    teamId: string,
    query: string,
  ): Promise<ReferenceAnalysis> {
    const client = this.getClient();
    const [catalog, families] = await Promise.all([
      this.prisma.material.findMany({
        where: { teamId },
        select: { name: true, family: true, descriptors: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.olfactiveFamily.findMany({
        select: { code: true, name: true },
      }),
    ]);
    const catalogText = catalog
      .map((m) => {
        const notes = Object.entries(
          (m.descriptors ?? {}) as Record<string, number>,
        )
          .filter(([, v]) => v >= SALIENT_DESCRIPTOR_MIN)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4)
          .map(([k]) => k)
          .join(', ');
        return `- ${m.name}${m.family ? ` (${m.family})` : ''}${notes ? ` : ${notes}` : ''}`;
      })
      .join('\n');
    const familyText = families.map((f) => `${f.code} ${f.name}`).join(' ; ');

    let response: OpenAI.Responses.Response;
    try {
      response = await client.responses.create({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        reasoning: { effort: 'low' },
        instructions: `Tu es l'assistant de la bibliothèque olfactive de Lylo Lab. Recherche sur le web le parfum de référence demandé (parfum existant, marque, tendance) : marque, année, parfumeur, famille olfactive, pyramide (notes de tête, de cœur, de fond) et une courte description. Utilise uniquement des informations trouvées dans tes sources ; mets null ou une liste vide si une information est introuvable.
Classe-le dans une famille ou sous-famille de la classification de la Société Française des Parfumeurs, en donnant son code : ${familyText}.
Puis propose une interprétation avec les matières du catalogue ci-dessous (noms exacts uniquement), en indiquant pour chacune son rôle (tête, cœur ou fond) et la note de la référence qu'elle évoque. Ne prétends jamais reproduire la formule exacte. Réponds en français, de façon concise.

Catalogue :
${catalogText}`,
        input: query,
        tools: [{ type: 'web_search' }],
        text: {
          format: {
            type: 'json_schema',
            name: 'reference_perfume',
            schema: REFERENCE_SCHEMA,
            strict: true,
          },
          verbosity: 'low',
        },
      });
    } catch (err) {
      throw this.requestError(err);
    }

    let parsed: Omit<ReferenceAnalysis, 'sources' | 'interpretation'> & {
      interpretation: { material: string; role: string; evokes: string }[];
    };
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new BadGatewayException(
        "La réponse de l'assistant IA est illisible, réessayez.",
      );
    }
    const byName = new Map(
      (
        await this.prisma.material.findMany({
          where: { teamId },
          select: { id: true, name: true },
        })
      ).map((m) => [m.name.toLowerCase(), m]),
    );
    return {
      ...parsed,
      sources: collectSources(response),
      interpretation: parsed.interpretation.flatMap((i) => {
        const material = byName.get(i.material.toLowerCase());
        return material
          ? [
              {
                materialId: material.id,
                material: material.name,
                role: i.role,
                evokes: i.evokes,
              },
            ]
          : [];
      }),
    };
  }

  async chat(teamId: string, dto: ChatDto): Promise<ChatResponse> {
    for await (const event of this.chatStream(teamId, dto)) {
      if (event.type === 'done') {
        const { type: _type, ...response } = event;
        return response;
      }
      if (event.type === 'error') throw new BadGatewayException(event.message);
    }
    throw new BadGatewayException(
      "L'assistant IA n'a pas terminé sa réponse, réessayez.",
    );
  }

  /**
   * Yields the message text as it is generated. When the model calls the
   * catalog tool, the tool runs here and the conversation continues in a new
   * request chained with previous_response_id.
   */
  async *chatStream(
    teamId: string,
    dto: ChatDto,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    try {
      const client = this.getClient();
      const { params, catalog } = await this.buildRequest(teamId, dto);

      let input: OpenAI.Responses.ResponseInput = params.input;
      let previousResponseId: string | undefined;

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let stream: AsyncIterable<OpenAI.Responses.ResponseStreamEvent>;
        try {
          stream = await client.responses.create(
            {
              ...params,
              input,
              ...(previousResponseId
                ? { previous_response_id: previousResponseId }
                : {}),
              ...(round === MAX_TOOL_ROUNDS - 1
                ? { tool_choice: 'none' as const }
                : {}),
              stream: true,
            },
            { signal },
          );
        } catch (err) {
          throw this.requestError(err);
        }

        const message = new MessageFieldStream();
        // Streamed responses carry no output_text helper: rebuild it from the deltas.
        let outputText = '';
        let completed: OpenAI.Responses.Response | null = null;
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
              outputText += event.delta;
              const text = message.push(event.delta);
              if (text) yield { type: 'delta', text };
            } else if (event.type === 'response.web_search_call.in_progress') {
              yield { type: 'status', status: 'search' };
            } else if (event.type === 'response.completed') {
              completed = event.response;
            } else if (
              event.type === 'response.failed' ||
              event.type === 'error'
            ) {
              throw this.requestError(event);
            }
          }
        } catch (err) {
          if (err instanceof BadGatewayException || signal?.aborted) throw err;
          throw this.requestError(err);
        }
        if (!completed) {
          throw new BadGatewayException(
            "L'assistant IA n'a pas terminé sa réponse, réessayez.",
          );
        }

        const calls = completed.output.filter(
          (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
            item.type === 'function_call',
        );
        if (calls.length === 0) {
          yield {
            type: 'done',
            ...this.finalize(completed, catalog, outputText),
          };
          return;
        }

        yield { type: 'status', status: 'catalog' };
        previousResponseId = completed.id;
        input = calls.map((call) => ({
          type: 'function_call_output' as const,
          call_id: call.call_id,
          output:
            call.name === CATALOG_TOOL_NAME
              ? this.runCatalogTool(catalog, call.arguments)
              : `Outil inconnu : ${call.name}`,
        }));
      }
      throw new BadGatewayException(
        "L'assistant IA n'a pas terminé sa réponse, réessayez.",
      );
    } catch (err) {
      if (signal?.aborted) return;
      const message =
        err instanceof BadGatewayException ||
        err instanceof ServiceUnavailableException
          ? err.message
          : "L'assistant IA n'a pas pu répondre.";
      yield { type: 'error', message };
    }
  }
}
