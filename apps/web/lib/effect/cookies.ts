import { Context, Data, Effect } from "effect";

export class CookiesError extends Data.TaggedError("CookiesError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class Cookies extends Context.Tag("app/Cookies")<
	Cookies,
	{
		readonly getCookie: (
			name: string
		) => Effect.Effect<string | null, CookiesError>;
		readonly setCookie: (
			name: string,
			value: string
		) => Effect.Effect<void, CookiesError>;
		readonly deleteCookie: (name: string) => Effect.Effect<void, CookiesError>;
	}
>() {}
