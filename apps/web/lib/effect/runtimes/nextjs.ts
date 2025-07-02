import { Effect, Layer, ManagedRuntime, pipe, Schema } from "effect";
import { Cookies, CookiesError } from "../cookies";
import { cookies, headers } from "next/headers";
import { DatabaseError, Db } from "../db";
import { Auth, InvalidPublishableKeyError, InvalidSecretKeyError, InvalidSourceError, MissingAppUserIdError, MissingProjectIdError, MissingPublishableKeyError, MissingSecretKeyError } from "../auth";
import { BetterAuth, BetterAuthError } from "../better-auth";
import { Request } from "../request";
import { PerkService } from "@/lib/services/perks/perk.service";
import { err, ok, Result } from "neverthrow";
import { PerkRepository } from "@/lib/services/perks/perk.repository";
import { PaywallLocationService } from "@/lib/services/paywall-locations/paywall-location.service";
import { PaywallLocationRepository } from "@/lib/services/paywall-locations/paywall-location.repository";
import { PaywallRepository } from "@/lib/services/paywalls/paywall.repository";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";
import { ApiKeyRepository } from "@/lib/services/api-keys/api-key.repository";
import { ApiKeyService } from "@/lib/services/api-keys/api-key.service";
import { CustomerRepository } from "@/lib/services/customers/customer.repository";
import { CustomerService } from "@/lib/services/customers/customer.service";
import { EnvironmentService } from "@/lib/services/environments/environment.service";
import { OrganizationRepository } from "@/lib/services/organizations/organization.repository";
import { ProjectRepository } from "@/lib/services/projects/project.repository";
import { ProjectService } from "@/lib/services/projects/project.service";
import { ProductRepository } from "@/lib/services/products/product.repository";
import { ProductService } from "@/lib/services/products/product.service";
import { PaymentProviderRepository } from "@/lib/services/payment-providers/payment-provider.repository";
import { CheckoutSessionRepository } from "@/lib/services/checkout-session/checkout-session.repository";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors";
import { MissingEnvironmentError } from "../environment";

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

const RuntimeLayer = () => {
	const CoreLayer = pipe(
		Auth.Default,
		Layer.provideMerge(BetterAuth.Default),
		Layer.provideMerge(DbLive),
		Layer.provideMerge(CookiesLive),
		Layer.provideMerge(RequestLive),
		
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
	);

	return pipe(
		ServiceLayer,
		Layer.provideMerge(RepositoryLayer),
		Layer.provideMerge(CoreLayer)
	);
};

export const NextjsRuntime = ManagedRuntime.make(RuntimeLayer());
const createNextjsRuntime = () => {
	return ManagedRuntime.make(RuntimeLayer());
};

export class NextjsErrorResponse extends Schema.TaggedError<NextjsErrorResponse>()("NextjsErrorResponse", {
	code: Schema.String,
	message: Schema.String,
}) {}


// export const createEffectHandler = (context: HonoContextType) => <T, S>(effect: Effect.Effect<T, HonoErrorResponse, S>):  => {

// 		const runtime = createHonoRuntime(context);
// 		const result = yield* runtime.runPromise(effect);
// 		if (result.isErr()) {
// 			return result.error;
// 		}
// 		return result.value;

// };

type GenericErrors = NotFoundError | ForbiddenError | UnauthorizedError;
type SystemErrors =
	| CookiesError
	| DatabaseError
	| BetterAuthError
	| InvalidSourceError;
type AcceptableErrorTypes =
	| NextjsErrorResponse
	| GenericErrors
	| SystemErrors
	| MissingSecretKeyError
	| MissingPublishableKeyError
	| InvalidSecretKeyError
	| InvalidPublishableKeyError
	| MissingAppUserIdError
	| MissingEnvironmentError
	| MissingProjectIdError;

const handleGlobalErrors = (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	effect: Effect.Effect<any, AcceptableErrorTypes, any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Effect.Effect<any, NextjsErrorResponse, any> => {
	return pipe(
		effect,
		Effect.catchTags({
			NotFoundError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "NOT_FOUND",
						message: error.message,
					})
				),
			ForbiddenError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "FORBIDDEN",
						message: error.message,
					})
				),
			UnauthorizedError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
					})
				),
			CookiesError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
					})
				),
			DatabaseError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
					})
				),
			BetterAuthError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
					})
				),
			InvalidSourceError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
					})
				),
			MissingEnvironmentError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
					})
				),
			MissingSecretKeyError: () =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "UNAUTHORIZED",
						message: "Missing secret key error occured in nextjs runtime",
					})
				),
			MissingPublishableKeyError: () =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: "Missing secret key error occured in nextjs runtime",
					})
				),
			InvalidSecretKeyError: () =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid secret key error occured in nextjs runtime",
					})
				),
			InvalidPublishableKeyError: () =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid publishable key error occured in nextjs runtime",
					})
				),
			MissingAppUserIdError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
					})
				),
			MissingProjectIdError: (error) =>
				Effect.fail(
					new NextjsErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
					})
				),
			
		})
	);
};

export const runServerEffect = async <T, E extends AcceptableErrorTypes>(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	effect: Effect.Effect<T, E, any>
): Promise<Result<T, NextjsErrorResponse>> => {
	const runtime = createNextjsRuntime();
	return await runtime.runPromise(
		pipe(
			effect,
			Effect.flatMap((result) => {
				return Effect.succeed(ok(result));
			}),
			handleGlobalErrors,
			Effect.catchTags({
				NextjsErrorResponse: (error) =>
					Effect.succeed(err(error)),
			}),
			Effect.catchAll((error) => {
				console.error(error);
				return Effect.succeed(
					err(
						new NextjsErrorResponse({
							code: "INTERNAL_SERVER_ERROR",
							message: "Internal server error",
						})
					)
				);
			}),
			Effect.catchAllDefect((error) => {
				console.error(error);
				return Effect.succeed(
					err(
						new NextjsErrorResponse({
							code: "INTERNAL_SERVER_ERROR",
							message: "Internal server error",
						})
					)
				);
			})
		)
	);
}

// export const toNeverthrow = <
// 	TResult,
// 	TError extends { cause?: unknown; message: string },
// 	TContext,
// >(
// 	effect: Effect.Effect<TResult, TError, TContext>
// ): Effect.Effect<
// 	Result<TResult, VoidhashInternalServerError>,
// 	never,
// 	TContext
// > => {
// 	return Effect.map(effect, (e) =>
// 		ok<TResult, VoidhashInternalServerError>(e)
// 	).pipe(
// 		Effect.catchAll((error: TError) => {
// 			return Effect.succeed(
// 				err({
// 					code: "INTERNAL_SERVER_ERROR",
// 					message: "Internal server error",
// 					originalError: error.cause as Error,
// 				} satisfies VoidhashInternalServerError)
// 			);
// 		})
// 	);
// };
