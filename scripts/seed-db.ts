import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

/**
 * Database adapter for the seed scripts. A remote database (Railway proxy)
 * can take more than the default 1 s to accept a connection, especially when
 * it wakes up: the timeouts are raised to 15 s.
 */
export function seedAdapter() {
  const url = new URL(process.env.DATABASE_URL!);
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectTimeout: 15_000,
    acquireTimeout: 20_000,
    connectionLimit: 5,
  });
}
