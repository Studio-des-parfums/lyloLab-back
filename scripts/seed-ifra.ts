import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IFRA_FILE = join(__dirname, '..', 'data', 'ifra-regulatory.json');

async function main() {
  const raw = await readFile(IFRA_FILE, 'utf-8');
  const byCas: Record<string, Record<string, unknown>> = JSON.parse(raw);

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const materials = await prisma.material.findMany({
    where: { casNumber: { not: null } },
    select: { id: true, casNumber: true, name: true },
  });

  let updated = 0;
  const unmatchedCas: string[] = [];

  for (const [cas, entry] of Object.entries(byCas)) {
    const { name: _excelName, ...regulatory } = entry;
    const matches = materials.filter((m) => m.casNumber === cas);
    if (matches.length === 0) {
      unmatchedCas.push(cas);
      continue;
    }
    for (const material of matches) {
      await prisma.material.update({
        where: { id: material.id },
        data: { regulatory },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} materials with IFRA/regulatory data.`);
  console.log(`CAS numbers from the Excel file with no matching material: ${unmatchedCas.length}`);
  if (unmatchedCas.length) {
    console.log(unmatchedCas.join(', '));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
