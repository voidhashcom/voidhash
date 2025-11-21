// import { Client } from '@planetscale/database';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { MySql2Transaction } from 'drizzle-orm/mysql2';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import type { PlanetScaleTransaction } from 'drizzle-orm/planetscale-serverless';
// import { drizzle as drizzlePlanetscale } from 'drizzle-orm/planetscale-serverless';
import { reset } from 'drizzle-seed';
import mysql from 'mysql2/promise';
import * as schema from './schema';

export const createDb = () => {
  // if (process.env.DATABASE_HOST?.includes('psdb.cloud')) {
  //   const client = new Client({
  //     host: process.env.DATABASE_HOST,
  //     username: process.env.DATABASE_USERNAME,
  //     password: process.env.DATABASE_PASSWORD
  //   });

  //   return drizzlePlanetscale(client, { schema });
  // }
  const isPlanetscale = process.env.DATABASE_HOST?.includes('psdb.cloud');

  const connection = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USERNAME,
    database: process.env.DATABASE_NAME,
    password: process.env.DATABASE_PASSWORD,
    ssl: isPlanetscale ? { rejectUnauthorized: true } : undefined
  });

  return {
    mysql: connection,
    drizzle: drizzleMysql({
      client: connection,
      schema,
      mode: 'default'
    })
  };
};

const { drizzle: db } = createDb();

export type Database = ReturnType<typeof createDb>['drizzle'];
export type Transaction =
  | PlanetScaleTransaction<
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  | MySql2Transaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;

export * from 'drizzle-orm';
export { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
export { drizzle } from 'drizzle-orm/planetscale-serverless';

async function dangrously_resetDb() {
  await reset(db, schema);
}

export { db, dangrously_resetDb };
export * from './schema';
export * from './types';
