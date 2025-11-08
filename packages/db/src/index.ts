// import { Client } from '@planetscale/database';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { MySql2Transaction } from 'drizzle-orm/mysql2';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import type { PlanetScaleTransaction } from 'drizzle-orm/planetscale-serverless';
// import { drizzle as drizzlePlanetscale } from 'drizzle-orm/planetscale-serverless';
import { reset } from 'drizzle-seed';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const createDb = async () => {
  console.log(process.env);
  // if (process.env.DATABASE_HOST?.includes('psdb.cloud')) {
  //   const client = new Client({
  //     host: process.env.DATABASE_HOST,
  //     username: process.env.DATABASE_USERNAME,
  //     password: process.env.DATABASE_PASSWORD
  //   });

  //   return drizzlePlanetscale(client, { schema });
  // }
  const isPlanetscale = process.env.DATABASE_HOST?.includes('psdb.cloud');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USERNAME,
    database: process.env.DATABASE_NAME,
    password: process.env.DATABASE_PASSWORD,
    ssl: isPlanetscale ? { rejectUnauthorized: true } : undefined
  });

  return drizzleMysql({
    client: connection,
    schema,
    mode: 'default'
  });
};

const db = await createDb();

export type Database = Awaited<ReturnType<typeof createDb>>;
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
