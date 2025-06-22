import { headers } from "next/headers";
import { ServiceContext } from "@/lib/service-function";
import { HonoCookiesAdapter } from "./hono-cookies-adapter";
import { NextUnstableCacheAdapter } from "@/lib/nextjs/utils/next-unstable-cache-adapter";
import { Context } from "hono";
import { db } from "@voidhash/db";
import { ConsoleLogger } from "@/lib/logger/console";
import { env } from "@/lib/env";
import { PinoLogger } from "@/lib/logger/pino";

export const createServerServiceContext = async (
	honoContext: Context
): Promise<ServiceContext> => {
	return {
		source: "api-server",
		headers: await headers(),
		cache: new NextUnstableCacheAdapter(),
		cookies: new HonoCookiesAdapter(honoContext),
		db: db,
		logger:
			env.VERCEL_ENV !== "development"
				? new PinoLogger({
						requestId: honoContext.get("requestId"),
						environment: env.VERCEL_ENV ?? "unknown",
						application: "api",
					})
				: new ConsoleLogger({
						requestId: honoContext.get("requestId"),
						environment: env.VERCEL_ENV ?? "unknown",
						application: "api",
					}),
	};
};
