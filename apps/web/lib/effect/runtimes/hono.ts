import { Context, Data, Effect, Layer, ManagedRuntime, pipe } from "effect";
import { Cookies, CookiesError } from "../cookies";
import { DatabaseError, Db } from "../db";
import { Auth, InvalidPublishableKeyError, InvalidSecretKeyError, InvalidSourceError, MissingAppUserIdError, MissingPublishableKeyError, MissingSecretKeyError } from "../auth";
import { BetterAuth, BetterAuthError } from "../better-auth";
import { Request } from "../request";
import { PerkService } from "@/lib/services/perks/perk.service";
import { err, ok, Result } from "neverthrow";
import { VoidhashInternalServerError } from "@voidhash/lib/constants";
import { PerkRepository } from "@/lib/services/perks/perk.repository";
import { PaywallLocationService } from "@/lib/services/paywall-locations/paywall-location.service";
import { PaywallLocationRepository } from "@/lib/services/paywall-locations/paywall-location.repository";
import { PaywallRepository } from "@/lib/services/paywalls/paywall.repository";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";
import { ApiKeyRepository } from "@/lib/services/api-keys/api-key.repository";
import { ApiKeyService } from "@/lib/services/api-keys/api-key.service";
import { CustomerRepository } from "@/lib/services/customers/customer.repository";
import { CustomerService } from "@/lib/services/customers/customer.service";
import { Context as HonoContextType } from "../../api/hono/app";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ProjectRepository } from "@/lib/services/projects/project.repository";
import { OrganizationRepository } from "@/lib/services/organizations/organization.repository";
import { EnvironmentService } from "@/lib/services/environments/environment.service";
import { ProjectService } from "@/lib/services/projects/project.service";
import { ProductRepository } from "@/lib/services/products/product.repository";
import { ProductService } from "@/lib/services/products/product.service";
import { SdkService } from "@/lib/services/sdk/sdk.service";
import { PaymentProviderRepository } from "@/lib/services/payment-providers/payment-provider.repository";
import { CheckoutSessionRepository } from "@/lib/services/checkout-session/checkout-session.repository";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "../errors";
import { MissingEnvironmentError } from "../environment";

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

const RuntimeLayer = (context: HonoContextType) => {
	const CoreLayer = pipe(
		Auth.Default,
		Layer.provideMerge(BetterAuth.Default),
		Layer.provideMerge(DbLive),
		Layer.provideMerge(CookiesLive),
		Layer.provideMerge(RequestLive),
		Layer.provideMerge(Layer.succeed(HonoContext, context))
	);

	const RepositoryLayer = pipe(
		ApiKeyRepository.Default,
		Layer.provideMerge(CustomerRepository.Default),
		Layer.provideMerge(OrganizationRepository.Default),
		Layer.provideMerge(PaywallLocationRepository.Default),
		Layer.provideMerge(PaywallRepository.Default),
		Layer.provideMerge(PerkRepository.Default),
		Layer.provideMerge(ProductRepository.Default),
		Layer.provideMerge(ProjectRepository.Default),
		Layer.provideMerge(PaymentProviderRepository.Default),
		Layer.provideMerge(CheckoutSessionRepository.Default)
	);

	const ServiceLayer = pipe(
		PerkService.Default,
		Layer.provideMerge(ApiKeyService.Default),
		Layer.provideMerge(CustomerService.Default),
		Layer.provideMerge(EnvironmentService.Default),
		Layer.provideMerge(PaywallLocationService.Default),
		Layer.provideMerge(PaywallService.Default),
		Layer.provideMerge(ProductService.Default),
		Layer.provideMerge(ProjectService.Default),
		Layer.provideMerge(SdkService.Default)
	);

	return pipe(
		ServiceLayer,
		Layer.provideMerge(RepositoryLayer),
		Layer.provideMerge(CoreLayer)
	);
};

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

export class HonoErrorResponse extends Data.TaggedError("HonoErrorResponse")<{
	code: string;
	message: string;
	originalError?: Error;
}> {}

// export const createEffectHandler = (context: HonoContextType) => <T, S>(effect: Effect.Effect<T, HonoErrorResponse, S>):  => {
	
// 		const runtime = createHonoRuntime(context);
// 		const result = yield* runtime.runPromise(effect);
// 		if (result.isErr()) {
// 			return result.error;
// 		}
// 		return result.value;
	
// };

type GenericErrors = NotFoundError | ForbiddenError | UnauthenticatedError;
type SystemErrors = CookiesError | DatabaseError | BetterAuthError | InvalidSourceError
type AcceptableErrorTypes = HonoErrorResponse | GenericErrors | SystemErrors | MissingSecretKeyError | MissingPublishableKeyError | InvalidSecretKeyError | InvalidPublishableKeyError | MissingAppUserIdError | MissingEnvironmentError;

export const createEffectHandler = (context: HonoContextType) => 
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	<T, E extends AcceptableErrorTypes>(effect: Effect.Effect<T, E, any>) => {
		const runtime = createHonoRuntime(context);
		return runtime.runPromise(effect.pipe(
			handleGlobalErrors
		));
	};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleGlobalErrors = (effect: Effect.Effect<any, AcceptableErrorTypes, any>): Effect.Effect<any, HonoErrorResponse, any> => {
	return effect.pipe(
		Effect.catchTags({
			'NotFoundError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "NOT_FOUND",
				message: error.message,
				originalError: error,
			})),
			'ForbiddenError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "FORBIDDEN",
				message: error.message,
				originalError: error,
			})),
			'UnauthenticatedError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "UNAUTHENTICATED",
				message: error.message,
				originalError: error,
			})),
			'CookiesError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "INTERNAL_SERVER_ERROR",
				message: error.message,
				originalError: error,
			})),
			'DatabaseError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "INTERNAL_SERVER_ERROR",
				message: error.message,
				originalError: error,
			})),
			'BetterAuthError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "INTERNAL_SERVER_ERROR",
				message: error.message,
				originalError: error,
			})),
			'InvalidSourceError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "INTERNAL_SERVER_ERROR",
				message: error.message,
				originalError: error,
			})),
			'MissingEnvironmentError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "INTERNAL_SERVER_ERROR",
				message: error.message,
				originalError: error,
			})),
			'MissingSecretKeyError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "UNAUTHORIZED",
				message: error.message,
				originalError: error,
			})),
			'MissingPublishableKeyError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "UNAUTHORIZED",
				message: error.message,
				originalError: error,
			})),
			'InvalidSecretKeyError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "UNAUTHORIZED",
				message: error.message,
				originalError: error,
			})),
			'InvalidPublishableKeyError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "UNAUTHORIZED",
				message: error.message,
				originalError: error,
			})),
			'MissingAppUserIdError': (error) => Effect.succeed(new HonoErrorResponse({
				code: "UNAUTHORIZED",
				message: error.message,
				originalError: error,
			})),
		})
	);
};