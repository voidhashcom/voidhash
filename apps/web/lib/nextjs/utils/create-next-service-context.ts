import { headers } from "next/headers";
import { NextUnstableCacheAdapter } from "./next-unstable-cache-adapter";
import { NextCookiesAdapter } from "./next-cookies-adapter";
import { ServiceContext } from "@/lib/service-function";

export const createNextServiceContext = async (): Promise<ServiceContext> => {
	return {
		source: "nextjs",
		headers: await headers(),
		cache: new NextUnstableCacheAdapter(),
		cookies: new NextCookiesAdapter(),
	};
};
