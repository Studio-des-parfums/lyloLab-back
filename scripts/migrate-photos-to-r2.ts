/**
 * Copies the stability photos still stored in MySQL to the R2 bucket, then
 * clears their `data` column. Safe to re-run: only photos without a
 * storageKey are processed.
 *
 *   npx --yes tsx scripts/migrate-photos-to-r2.ts            # dry run
 *   npx --yes tsx scripts/migrate-photos-to-r2.ts --apply
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../src/storage/storage.service.js';

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});
const storage = new StorageService();

const pending = await prisma.stabilityPhoto.findMany({
  where: { storageKey: null },
  select: {
    id: true,
    mimeType: true,
    observation: { select: { testId: true, test: { select: { teamId: true } } } },
  },
});
console.log(`${pending.length} photo(s) à migrer${apply ? '' : ' (dry run, ajouter --apply)'}`);

let done = 0;
for (const p of pending) {
  const ext = p.mimeType.split('/')[1] ?? 'bin';
  const key = `teams/${p.observation.test.teamId}/stability/${p.observation.testId}/${p.id}.${ext}`;
  if (!apply) {
    console.log(`  ${p.id} → ${key}`);
    continue;
  }
  const row = await prisma.stabilityPhoto.findUnique({ where: { id: p.id }, select: { data: true } });
  if (!row?.data) continue;
  await storage.put(key, new Uint8Array(row.data), p.mimeType);
  await prisma.stabilityPhoto.update({ where: { id: p.id }, data: { storageKey: key, data: null } });
  done++;
  console.log(`  ✓ ${p.id}`);
}
if (apply) console.log(`${done} photo(s) migrée(s).`);
await prisma.$disconnect();
