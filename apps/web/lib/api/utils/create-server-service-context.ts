import { headers } from "next/headers";
import { ServiceContext } from "@/lib/service-function";
import { HonoCookiesAdapter } from "./hono-cookies-adapter";
import { NextUnstableCacheAdapter } from "@/lib/nextjs/utils/next-unstable-cache-adapter";
import { Context } from "hono";

export const createServerServiceContext = async (
	honoContext: Context
): Promise<ServiceContext> => {
	return {
		source: "api-server",
		headers: await headers(),
		cache: new NextUnstableCacheAdapter(),
		cookies: new HonoCookiesAdapter(honoContext),
	};
};
