import { headers } from "next/headers";
import { NextUnstableCacheAdapter } from "./next-unstable-cache-adapter";
import { NextCookiesAdapter } from "./next-cookies-adapter";
import { ServiceContext } from "@/lib/service-function";
import { db } from "@voidhash/db";
import { ConsoleLogger } from "@/lib/logger/console";
import { env } from "@/lib/env";

export const createNextServiceContext = async (): Promise<ServiceContext> => {
	return {
		source: "nextjs",
		headers: await headers(),
		cache: new NextUnstableCacheAdapter(),
		cookies: new NextCookiesAdapter(),
		db: db,
		logger: new ConsoleLogger({
			requestId: "",
			environment: env.VERCEL_ENV ?? "unknown",
			application: "web",
		}),
	};
};
