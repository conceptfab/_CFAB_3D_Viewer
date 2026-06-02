import type { Config } from 'drizzle-kit';

export default {
  schema: ['./lib/db/schema.ts', './lib/scenes/schema.ts', './lib/studio/schema.ts'],
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
