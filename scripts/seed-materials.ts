import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MATERIALS_FILE = join(__dirname, '..', 'data', 'materials.json');

interface Material {
  id: string;
  casNumber: string | null;
  name: string;
  family: string | null;
  sensation: string | null;
  weight: number | null;
  subjectivePower: number | null;
  descriptors: Record<string, number>;
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
  const raw = await readFile(MATERIALS_FILE, 'utf-8');
  const materials: Material[] = JSON.parse(raw);

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  const teamId = seedTeamId();

  console.log(`Seeding ${materials.length} materials...`);

  for (const material of materials) {
    const { id: _extractionSlug, ...data } = material;
    await prisma.material.upsert({
      where: { teamId_name: { teamId, name: material.name } },
      create: { ...data, teamId },
      update: data,
    });
  }

  const count = await prisma.material.count({ where: { teamId } });
  console.log(`Done. ${count} materials now in database.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
