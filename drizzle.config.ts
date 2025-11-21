/** biome-ignore-all lint/style/noNonNullAssertion: ok in this config file */
/** biome-ignore-all lint/complexity/useLiteralKeys: it is ok */
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'mysql',
  schema: './packages/db/src/schema.ts',
  out: './packages/db/src/migrations',
  dbCredentials: {
    ...(process.env['NODE_ENV'] === 'production'
      ? {
          url: `mysql://${process.env['DATABASE_USERNAME']}:${process.env['DATABASE_PASSWORD']}@${process.env['DATABASE_HOST']}/${process.env['DATABASE_NAME']}?ssl={"rejectUnauthorized":true}`
        }
      : {
          host: process.env['DATABASE_HOST']!,
          user: process.env['DATABASE_USERNAME']!,
          database: process.env['DATABASE_NAME']!,
          password: process.env['DATABASE_PASSWORD']!
        })
  },
  tablesFilter: ['!cluster_*']
});
