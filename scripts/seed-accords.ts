import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACCORDS_FILE = join(__dirname, '..', 'data', 'accords.json');

interface AccordLine {
  name: string;
  quantity: number;
  descriptors: Record<string, number>;
}

interface Accord {
  id: string;
  name: string;
  lines: AccordLine[];
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Seeded data belongs to one team: its id is given by SEED_TEAM_ID.
function seedTeamId(): string {
  const teamId = process.env.SEED_TEAM_ID;
  if (!teamId) {
    console.error("Définissez SEED_TEAM_ID (id de l'équipe qui reçoit les données).");
    process.exit(1);
  }
  return teamId;
}

async function main() {
  const raw = await readFile(ACCORDS_FILE, 'utf-8');
  const accords: Accord[] = JSON.parse(raw);

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  const teamId = seedTeamId();

  const existingMaterials = await prisma.material.findMany({
    where: { teamId },
    select: { id: true, name: true },
  });
  const byNormalizedName = new Map(
    existingMaterials.map((m) => [normalize(m.name), m.id]),
  );
  const usedNames = new Set(existingMaterials.map((m) => m.name));

  let newMaterialsCount = 0;
  let linkedToExistingCount = 0;

  for (const accord of accords) {
    const existingFormula = await prisma.formula.findFirst({
      where: { name: accord.name, source: 'accord', teamId },
    });

    const formula = existingFormula
      ? await prisma.formula.update({
          where: { id: existingFormula.id },
          data: { name: accord.name },
        })
      : await prisma.formula.create({
          data: { name: accord.name, source: 'accord', teamId },
        });

    // clear previous lines so re-running the seed doesn't duplicate them
    await prisma.formulaLine.deleteMany({ where: { formulaId: formula.id } });

    for (const line of accord.lines) {
      const normalized = normalize(line.name);
      let materialId = byNormalizedName.get(normalized);

      if (!materialId) {
        let name = line.name;
        if (usedNames.has(name)) {
          let suffix = 2;
          while (usedNames.has(`${name} (variante ${suffix})`)) suffix++;
          name = `${name} (variante ${suffix})`;
        }
        usedNames.add(name);

        const created = await prisma.material.create({
          data: {
            name,
            descriptors: line.descriptors,
            source: 'accord',
            teamId,
          },
        });
        materialId = created.id;
        byNormalizedName.set(normalized, materialId);
        newMaterialsCount++;
      } else {
        linkedToExistingCount++;
      }

      await prisma.formulaLine.create({
        data: {
          formulaId: formula.id,
          materialId,
          quantity: line.quantity,
        },
      });
    }

    console.log(`Seeded formula "${accord.name}" with ${accord.lines.length} lines`);
  }

  console.log(
    `Done. ${linkedToExistingCount} lines linked to existing materials, ${newMaterialsCount} new materials created.`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
