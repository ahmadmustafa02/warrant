import 'dotenv/config';
import { prisma } from '@/server/db';

/**
 * Proves the full data path works end to end: validated env, driver adapter,
 * migrated schema. Run with `pnpm run db:check`.
 */
async function main(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  console.log(`Connected. ${tables.length} tables in public schema:`);
  for (const { table_name } of tables) {
    console.log(`  - ${table_name}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('Database check failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
