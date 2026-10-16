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

function slugify(name: string): string {
  return normalize(name).replace(/\s+/g, '-');
}

async function main() {
  const raw = await readFile(ACCORDS_FILE, 'utf-8');
  const accords: Accord[] = JSON.parse(raw);

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const existingMaterials = await prisma.material.findMany({
    select: { id: true, name: true },
  });
  const byNormalizedName = new Map(
    existingMaterials.map((m) => [normalize(m.name), m.id]),
  );

  let newMaterialsCount = 0;
  let linkedToExistingCount = 0;

  for (const accord of accords) {
    await prisma.formula.upsert({
      where: { id: accord.id },
      create: { id: accord.id, name: accord.name },
      update: { name: accord.name },
    });

    // clear previous lines so re-running the seed doesn't duplicate them
    await prisma.formulaLine.deleteMany({ where: { formulaId: accord.id } });

    for (const line of accord.lines) {
      const normalized = normalize(line.name);
      let materialId = byNormalizedName.get(normalized);

      if (!materialId) {
        materialId = slugify(line.name);
        // guard against id collisions with materials created earlier in this run
        let suffix = 2;
        let candidateId = materialId;
        while (byNormalizedName.has(candidateId)) {
          candidateId = `${materialId}-${suffix}`;
          suffix++;
        }

        await prisma.material.create({
          data: {
            id: materialId,
            name: line.name,
            descriptors: line.descriptors,
            source: 'accord',
          },
        });
        byNormalizedName.set(normalized, materialId);
        newMaterialsCount++;
      } else {
        linkedToExistingCount++;
      }

      await prisma.formulaLine.create({
        data: {
          formulaId: accord.id,
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
