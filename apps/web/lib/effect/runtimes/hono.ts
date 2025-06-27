import { Context, Effect, Layer, ManagedRuntime, pipe } from "effect";
import { Cookies } from "../cookies";
import { Db } from "../db";
import { Auth } from "../auth";
import { BetterAuth } from "../better-auth";
import { Request } from "../request";
import { PerkService } from "@/lib/services/perks/perk-service";
import { err, ok, Result } from "neverthrow";
import { VoidhashInternalServerError } from "@voidhash/lib/constants";
import { PerkRepository } from "@/lib/services/perks/perk-repository";
import { PaywallLocationService } from "@/lib/services/paywall-locations/paywall-location-service";
import { PaywallLocationRepository } from "@/lib/services/paywall-locations/paywall-location-repository";
import { PaywallRepository } from "@/lib/services/paywalls/paywall-repository";
import { ApiKeyRepository } from "@/lib/services/api-keys/api-key-repository";
import { ApiKeyService } from "@/lib/services/api-keys/api-key-service";
import { CustomerRepository } from "@/lib/services/customers/customer-repository";
import { CustomerService } from "@/lib/services/customers/customer-service";
import { Context as HonoContextType } from "../../api/hono/app";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ProjectRepository } from "@/lib/services/projects/project-repository";
import { OrganizationRepository } from "@/lib/services/organizations/organization-repository";
import { EnvironmentService } from "@/lib/services/environments/environment-service";

export class HonoContext extends Context.Tag("app/HonoContext")<
	HonoContext,
	HonoContextType
>() {}

const CookiesLive = Layer.effect(
	Cookies,
	Effect.gen(function* () {
		const honoContext = yield* HonoContext;
		return {
			getCookie: (name) =>
				Effect.gen(function* () {
					return getCookie(honoContext, name) ?? null;
				}),
			setCookie: (name, value) =>
				Effect.gen(function* () {
					setCookie(honoContext, name, value);
					return;
				}),
			deleteCookie: (name) =>
				Effect.gen(function* () {
					deleteCookie(honoContext, name);
					return;
				}),
		};
	})
);

const RequestLive = Layer.effect(
	Request,
	Effect.gen(function* () {
		const c = yield* HonoContext;
		const sdkPathPrefixes = ["/api/v1/sdk", "/v1/sdk"];

		const isSdkPathname = sdkPathPrefixes.some((prefix) =>
			c.req.path.startsWith(prefix)
		);

		const source = isSdkPathname ? "api-sdk" : "api-server";

		return {
			getSource: Effect.succeed(source as "nextjs" | "api-server" | "api-sdk"),
			getHeaders: Effect.promise(async () => c.req.raw.headers),
		};
	})
);

const DbLive = Db.Default;

const RuntimeLayer = (context: HonoContextType) =>
	pipe(
		PerkService.Default,
		Layer.provideMerge(Auth.Default),
		Layer.provideMerge(BetterAuth.Default),

		// Services
		Layer.provideMerge(ApiKeyService.Default),
		Layer.provideMerge(CustomerService.Default),
		Layer.provideMerge(EnvironmentService.Default),
		Layer.provideMerge(PaywallLocationService.Default),
		
		// Repositories
		Layer.provideMerge(ApiKeyRepository.Default),
		Layer.provideMerge(CustomerRepository.Default),
		Layer.provideMerge(OrganizationRepository.Default),
		Layer.provideMerge(PaywallLocationRepository.Default),
		Layer.provideMerge(PaywallRepository.Default),
		Layer.provideMerge(PerkRepository.Default),
		Layer.provideMerge(ProjectRepository.Default),
	
		Layer.provideMerge(DbLive),
		Layer.provideMerge(CookiesLive),
		Layer.provideMerge(RequestLive),
		Layer.provideMerge(Layer.succeed(HonoContext, context))
	);

export const createHonoRuntime = (context: HonoContextType) =>
	ManagedRuntime.make(RuntimeLayer(context));

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
