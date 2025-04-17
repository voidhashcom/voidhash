import { CookiesAdapter } from "@/lib/cookies-adapter";
import { NextRequest } from "next/server";

export class NextMiddlewareCookiesAdapter implements CookiesAdapter {
	constructor(private readonly req: NextRequest) {}

	async get(name: string): Promise<string | null> {
		return this.req.cookies.get(name)?.value ?? null;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async set(_: string, __: string): Promise<void> {
		throw new Error("Settings cookies is not allowed in next.js middleware");
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async delete(_: string): Promise<void> {
		throw new Error("Deleting cookies is not allowed in next.js middleware");
	}
}
