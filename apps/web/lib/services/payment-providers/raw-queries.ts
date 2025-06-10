import {
	ProjectPaymentProviderConfiguration,
	projectPaymentProviderConfigurations,
} from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	fromUnknownThrow,
} from "@voidhash/lib/constants";

import { Result, ResultAsync, err, ok } from "neverthrow";

export const getPaymentProviderConfigurationsQuery = async (
	ctx: ServiceContext,
	projectId: string
): Promise<
	Result<ProjectPaymentProviderConfiguration[], VoidhashInternalServerError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.projectPaymentProviderConfigurations.findMany({
			where: eq(projectPaymentProviderConfigurations.projectId, projectId),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value ?? []);
};

export const getPaymentProviderConfigurationByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<
		ProjectPaymentProviderConfiguration,
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.projectPaymentProviderConfigurations.findFirst({
			where: eq(projectPaymentProviderConfigurations.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Payment provider configuration not found",
			resource: "payment_provider_configuration",
			payload: {
				id,
			},
		});
	}
	return ok(res.value);
};

export const getExistingPaymentProviderConfigurationByIdQuery = async (
	ctx: ServiceContext,
	projectId: string,
	providerId: string
): Promise<
	Result<
		ProjectPaymentProviderConfiguration,
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.projectPaymentProviderConfigurations.findFirst({
			where: and(
				eq(projectPaymentProviderConfigurations.projectId, projectId),
				eq(projectPaymentProviderConfigurations.providerId, providerId)
			),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Payment provider configuration not found",
			resource: "payment_provider_configuration",
			payload: {
				projectId,
				providerId,
			},
		});
	}
	return ok(res.value);
};
