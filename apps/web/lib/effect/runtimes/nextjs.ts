import { Effect, Layer, ManagedRuntime, pipe } from "effect";
import { Cookies, CookiesError } from "../cookies";
import { cookies, headers } from "next/headers";
import { Db } from "../db";
import { Auth } from "../auth";
import { BetterAuth } from "../better-auth";
import { Request } from "../request";
import { PerkService } from "@/lib/services/perks/perk-service";
import { err, ok, Result } from "neverthrow";
import { VoidhashInternalServerError } from "@voidhash/lib/constants";
import { PerkRepository } from "@/lib/services/perks/perk-repository";

const CookiesLive = Layer.succeed(
	Cookies,
	Cookies.of({
		getCookie: (name) =>
			Effect.tryPromise({
				try: async () => (await cookies()).get(name)?.value ?? null,
				catch: (error) =>
					new CookiesError({ message: "Failed to get cookie", cause: error }),
			}),
		setCookie: (name, value) =>
			Effect.tryPromise({
				try: async () => (await cookies()).set(name, value),
				catch: (error) =>
					new CookiesError({ message: "Failed to set cookie", cause: error }),
			}),
		deleteCookie: (name) =>
			Effect.tryPromise({
				try: async () => (await cookies()).delete(name),
				catch: (error) =>
					new CookiesError({
						message: "Failed to delete cookie",
						cause: error,
					}),
			}),
	})
);

const RequestLive = Layer.succeed(
	Request,
	Request.of({
		getSource: Effect.succeed("nextjs"),
		getHeaders: Effect.promise(async () => new Headers(await headers())),
	})
);

const DbLive = Db.Default;

const RuntimeLayer = pipe(
	PerkService.Default,
	Layer.provideMerge(PerkRepository.Default),
	Layer.provideMerge(Auth.Default),
	Layer.provideMerge(BetterAuth.Default),
	Layer.provideMerge(DbLive),
	Layer.provideMerge(CookiesLive),
	Layer.provideMerge(RequestLive)
);

export const NextjsRuntime = ManagedRuntime.make(RuntimeLayer);

export const toNeverthrow = <
	TResult,
	TError extends { cause?: unknown; message: string },
	TContext,
>(
	effect: Effect.Effect<TResult, TError, TContext>
): Effect.Effect<
	Result<TResult, VoidhashInternalServerError>,
	never,
	TContext
> => {
	return Effect.map(effect, (e) =>
		ok<TResult, VoidhashInternalServerError>(e)
	).pipe(
		Effect.catchAll((error: TError) => {
			return Effect.succeed(
				err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Internal server error",
					originalError: error.cause as Error,
				} satisfies VoidhashInternalServerError)
			);
		})
	);
};
