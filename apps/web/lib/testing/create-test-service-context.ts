import { ServiceContext } from "@/lib/service-function";
import { db } from "@voidhash/db";
import { NextUnstableCacheAdapter } from "../nextjs/utils/next-unstable-cache-adapter";
import { NextCookiesAdapter } from "../nextjs/utils/next-cookies-adapter";
import { ConsoleLogger } from "../logger/console";

export async function createTestServiceContext(): Promise<ServiceContext> {
	return {
		source: "api-server",
		headers: new Headers(),
		cache: new NextUnstableCacheAdapter(),
		cookies: new NextCookiesAdapter(),
		db: db,
		logger: new ConsoleLogger({
			requestId: "",
			environment: "unknown",
			application: "api",
		}),
	};
}
