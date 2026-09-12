import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 no longer loads .env implicitly, so the CLI gets its datasource here.
 * The application itself receives DATABASE_URL from the Next.js runtime.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
