import { headers } from "next/headers";
import { NextUnstableCacheAdapter } from "./next-unstable-cache-adapter";
import { NextCookiesAdapter } from "./next-cookies-adapter";

export const createNextServiceContext = async () => {
	return {
		headers: await headers(),
		cache: new NextUnstableCacheAdapter(),
		cookies: new NextCookiesAdapter(),
	};
};
