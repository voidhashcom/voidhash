import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

export const db = drizzle({
	connection: { uri: process.env.DATABASE_URL },
});

export * from "./schema";
