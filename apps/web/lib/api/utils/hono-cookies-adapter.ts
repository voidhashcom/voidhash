import { CookiesAdapter } from "@/lib/cookies-adapter";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { Context } from "hono";

export class NextMiddlewareCookiesAdapter implements CookiesAdapter {
	constructor(private readonly honoContext: Context) {}

	async get(name: string): Promise<string | null> {
		return getCookie(this.honoContext, name) ?? null;
	}

	async set(name: string, value: string): Promise<void> {
		setCookie(this.honoContext, name, value);
	}

	async delete(name: string): Promise<void> {
		deleteCookie(this.honoContext, name);
	}
}
