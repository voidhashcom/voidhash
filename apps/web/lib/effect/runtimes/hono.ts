import {
	Cause,
	Context,
	Data,
	Effect,
	Exit,
	Layer,
	ManagedRuntime,
	Option,
	pipe,
} from "effect";
import { Cookies, CookiesError } from "../cookies";
import { DatabaseError, Db } from "../db";
import {
	AuthService,
	InvalidPublishableKeyError,
	InvalidSecretKeyError,
	InvalidSourceError,
	MissingAppUserIdError,
	MissingProjectIdError,
	MissingPublishableKeyError,
	MissingSecretKeyError,
} from "../../services/auth.service";
import { BetterAuth, BetterAuthError } from "../better-auth";
import { Request } from "../request";
import { PerkService } from "@/lib/services/perk.service";
import { PerkRepository } from "@/lib/repositories/perk.repository";
import { PaywallLocationService } from "@/lib/services/paywall-location.service";
import { PaywallLocationRepository } from "@/lib/repositories/paywall-location.repository";
import { PaywallRepository } from "@/lib/repositories/paywall.repository";
import { PaywallService } from "@/lib/services/paywall.service";
import { ApiKeyRepository } from "@/lib/repositories/api-key.repository";
import { ApiKeyService } from "@/lib/services/api-key.service";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { CustomerService } from "@/lib/services/customer.service";
import { Context as HonoContextType } from "../../api/hono/app";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ProjectRepository } from "@/lib/repositories/project.repository";
import { OrganizationRepository } from "@/lib/repositories/organization.repository";
import {
	EnvironmentService,
	InvalidEnvironmentError,
	OrganizationNotFoundInSessionError,
	ProjectNotFoundInSessionError,
} from "@/lib/services/environment.service";
import { ProjectService } from "@/lib/services/project.service";
import { ProductRepository } from "@/lib/repositories/product.repository";
import { ProductService } from "@/lib/services/product.service";
import { SdkService } from "@/lib/services/sdk.service";
import { PaymentProviderRepository } from "@/lib/repositories/payment-provider.repository";
import { CheckoutSessionRepository } from "@/lib/repositories/checkout-session.repository";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors";
import { MissingEnvironmentError } from "../../services/environment.service";
import { ErrorCode, errorResponse } from "@/lib/api/errors/http";
import { z } from "zod";
import { DevCheckoutService } from "@/lib/payment-providers/dev-checkout/dev-checkout.service";
import { PaymentProviderConfigurationProductRepository } from "@/lib/repositories/payment-provider-configuration-product.repository";
import { ProductPerkRepository } from "@/lib/repositories/product-perk.repository";
import { OrganizationService } from "@/lib/services/organization.service";
import { PaymentProviderService } from "@/lib/services/payment-provider.service";
import { UserService } from "@/lib/services/user.service";
import { HonoRuntimeTag } from "./tags";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { unstable_rethrow } from "next/navigation";

export class HonoContext extends Context.Tag("app/HonoContext")<
	HonoContext,
	HonoContextType
>() {}

const HonoRuntimeTagLive = Layer.succeed(
	HonoRuntimeTag,
	HonoRuntimeTag.of("hono")
);

const CookiesLive = Layer.effect(
	Cookies,
	Effect.gen(function* () {
		return {
			getCookie: (name) =>
				Effect.gen(function* () {
					const honoContext = yield* Effect.serviceOption(HonoContext);
					if (Option.isNone(honoContext)) {
						return yield* Effect.fail(
							new CookiesError({
								message: "Hono context not found",
							})
						);
					}
					return getCookie(honoContext.value, name) ?? null;
				}),
			setCookie: (name, value) =>
				Effect.gen(function* () {
					console.log("setCookie", name, value);
					const honoContext = yield* Effect.serviceOption(HonoContext);
					if (Option.isNone(honoContext)) {
						return yield* Effect.fail(
							new CookiesError({
								message: "Hono context not found",
							})
						);
					}
					setCookie(honoContext.value, name, value);
					return;
				}),
			deleteCookie: (name) =>
				Effect.gen(function* () {
					const honoContext = yield* Effect.serviceOption(HonoContext);
					if (Option.isNone(honoContext)) {
						return yield* Effect.fail(
							new CookiesError({
								message: "Hono context not found",
							})
						);
					}
					deleteCookie(honoContext.value, name);
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
		AuthService.Default,
		Layer.provideMerge(BetterAuth.Default),
		Layer.provideMerge(DbLive),
		Layer.provideMerge(CookiesLive),
		Layer.provideMerge(RequestLive),
		Layer.provideMerge(Layer.succeed(HonoContext, context)),
		Layer.provideMerge(HonoRuntimeTagLive)
	);

	const RepositoryLayer = pipe(
		ApiKeyRepository.Default,
		Layer.provideMerge(CustomerRepository.Default),
		Layer.provideMerge(CheckoutSessionRepository.Default),
		Layer.provideMerge(OrganizationRepository.Default),
		Layer.provideMerge(PaymentProviderConfigurationProductRepository.Default),
		Layer.provideMerge(PaymentProviderRepository.Default),
		Layer.provideMerge(PaywallLocationRepository.Default),
		Layer.provideMerge(PaywallRepository.Default),
		Layer.provideMerge(PerkRepository.Default),
		Layer.provideMerge(ProductPerkRepository.Default),
		Layer.provideMerge(ProductRepository.Default),
		Layer.provideMerge(ProjectRepository.Default)
	);

	const ServiceLayer = pipe(
		ApiKeyService.Default,
		Layer.provideMerge(CustomerService.Default),
		Layer.provideMerge(EnvironmentService.Default),
		Layer.provideMerge(OrganizationService.Default),
		Layer.provideMerge(PaymentProviderService.Default),
		Layer.provideMerge(PaywallLocationService.Default),
		Layer.provideMerge(PaywallService.Default),
		Layer.provideMerge(PerkService.Default),
		Layer.provideMerge(ProductService.Default),
		Layer.provideMerge(ProjectService.Default),
		Layer.provideMerge(SdkService.Default),
		Layer.provideMerge(UserService.Default),
		Layer.provideMerge(DevCheckoutService.Default)
	);

	return pipe(
		ServiceLayer,
		Layer.provideMerge(RepositoryLayer),
		Layer.provideMerge(CoreLayer)
	);
};

export const createHonoRuntime = (context: HonoContextType) =>
	ManagedRuntime.make(RuntimeLayer(context));

export class HonoErrorResponse extends Data.TaggedError("HonoErrorResponse")<{
	code: z.infer<typeof ErrorCode>;
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

type GenericErrors = NotFoundError | ForbiddenError | UnauthorizedError;
type SystemErrors =
	| CookiesError
	| DatabaseError
	| BetterAuthError
	| InvalidSourceError;
type AcceptableErrorTypes =
	| HonoErrorResponse
	| GenericErrors
	| SystemErrors
	| MissingSecretKeyError
	| MissingPublishableKeyError
	| InvalidSecretKeyError
	| InvalidPublishableKeyError
	| MissingAppUserIdError
	| MissingEnvironmentError
	| MissingProjectIdError
	| ProjectNotFoundInSessionError
	| OrganizationNotFoundInSessionError
	| InvalidEnvironmentError;

const handleGlobalErrors = (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	effect: Effect.Effect<any, AcceptableErrorTypes, any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Effect.Effect<any, HonoErrorResponse, any> => {
	return pipe(
		effect,
		Effect.catchTags({
			NotFoundError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "NOT_FOUND",
						message: error.message,
						originalError: error,
					})
				),
			ForbiddenError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "FORBIDDEN",
						message: error.message,
						originalError: error,
					})
				),
			UnauthorizedError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
						originalError: error,
					})
				),
			CookiesError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			DatabaseError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			BetterAuthError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			InvalidSourceError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			MissingEnvironmentError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			MissingSecretKeyError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
						originalError: error,
					})
				),
			MissingPublishableKeyError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
						originalError: error,
					})
				),
			InvalidSecretKeyError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
						originalError: error,
					})
				),
			InvalidPublishableKeyError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
						originalError: error,
					})
				),
			MissingAppUserIdError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "UNAUTHORIZED",
						message: error.message,
						originalError: error,
					})
				),
			MissingProjectIdError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			ProjectNotFoundInSessionError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			OrganizationNotFoundInSessionError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
			InvalidEnvironmentError: (error) =>
				Effect.fail(
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						originalError: error,
					})
				),
		})
	);
};

const toHonoErrorResponse = (c: HonoContextType, error: HonoErrorResponse) => {
	return errorResponse(c, error.code, error.message);
};

type AvailableServices = Layer.Layer.Success<ReturnType<typeof RuntimeLayer>>;

export const createEffectHandler =
	(context: HonoContextType) =>
	async <T, E extends AcceptableErrorTypes, C extends AvailableServices>(
		effect: Effect.Effect<T, E, C>
	) => {
		const runtime = createHonoRuntime(context);
		const result = await runtime.runPromiseExit(
			pipe(
				effect,
				handleGlobalErrors,
				Effect.catchTags({
					HonoErrorResponse: (error) =>
						Effect.succeed(toHonoErrorResponse(context, error)),
				}),
				Effect.catchAll((error) => {
					return Effect.succeed(
						toHonoErrorResponse(
							context,
							new HonoErrorResponse({
								code: "INTERNAL_SERVER_ERROR",
								message: "Internal server error",
								originalError: error,
							})
						)
					);
				})
			)
		);

		return Exit.match(result, {
			onSuccess: (value) => value,
			onFailure: (error) => {
				if (Cause.isDie(error)) {
					const defects = Cause.defects(error);
					for (const defect of defects) {
						if (isDynamicServerError(defect)) {
							unstable_rethrow(defect);
						}
					}
				}
				return toHonoErrorResponse(
					context,
					new HonoErrorResponse({
						code: "INTERNAL_SERVER_ERROR",
						message: "Internal server error",
					})
				);
			},
		});
	};
