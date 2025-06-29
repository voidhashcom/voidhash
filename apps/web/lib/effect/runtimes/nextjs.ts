import { Effect, Layer, ManagedRuntime, pipe } from "effect";
import { Cookies, CookiesError } from "../cookies";
import { cookies, headers } from "next/headers";
import { Db } from "../db";
import { Auth } from "../auth";
import { BetterAuth } from "../better-auth";
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
import { EnvironmentService } from "@/lib/services/environments/environment.service";
import { OrganizationRepository } from "@/lib/services/organizations/organization.repository";
import { ProjectRepository } from "@/lib/services/projects/project.repository";
import { ProjectService } from "@/lib/services/projects/project.service";
import { ProductRepository } from "@/lib/services/products/product.repository";
import { ProductService } from "@/lib/services/products/product.service";

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

const CoreLayer = pipe(
	Auth.Default,
	Layer.provideMerge(BetterAuth.Default),
	Layer.provideMerge(DbLive),
	Layer.provideMerge(CookiesLive),
	Layer.provideMerge(RequestLive)
);

const RepositoryLayer = pipe(
	ApiKeyRepository.Default,
	Layer.provideMerge(CustomerRepository.Default),
	Layer.provideMerge(OrganizationRepository.Default),
	Layer.provideMerge(PaywallLocationRepository.Default),
	Layer.provideMerge(PaywallRepository.Default),
	Layer.provideMerge(PerkRepository.Default),
	Layer.provideMerge(ProductRepository.Default),
	Layer.provideMerge(ProjectRepository.Default)
);

const ServiceLayer = pipe(
	PerkService.Default,
	Layer.provideMerge(ApiKeyService.Default),
	Layer.provideMerge(CustomerService.Default),
	Layer.provideMerge(EnvironmentService.Default),
	Layer.provideMerge(PaywallLocationService.Default),
	Layer.provideMerge(PaywallService.Default),
	Layer.provideMerge(ProductService.Default),
	Layer.provideMerge(ProjectService.Default)
);

const RuntimeLayer = pipe(
	ServiceLayer,
	Layer.provideMerge(RepositoryLayer),
	Layer.provideMerge(CoreLayer)
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
