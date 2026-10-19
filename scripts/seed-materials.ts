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

async function main() {
  const raw = await readFile(MATERIALS_FILE, 'utf-8');
  const materials: Material[] = JSON.parse(raw);

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  console.log(`Seeding ${materials.length} materials...`);

  for (const material of materials) {
    const { id: _extractionSlug, ...data } = material;
    await prisma.material.upsert({
      where: { name: material.name },
      create: data,
      update: data,
    });
  }

  const count = await prisma.material.count();
  console.log(`Done. ${count} materials now in database.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
