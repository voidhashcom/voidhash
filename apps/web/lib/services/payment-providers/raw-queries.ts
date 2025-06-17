import {
	PaymentProviderConfiguration,
	paymentProviderConfigurations,
} from "@voidhash/db";
import { and, eq, isNull } from "drizzle-orm";
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
	Result<PaymentProviderConfiguration[], VoidhashInternalServerError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.paymentProviderConfigurations.findMany({
			where: and(
				eq(paymentProviderConfigurations.projectId, projectId),
				isNull(paymentProviderConfigurations.deletedAt)
			),
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
		PaymentProviderConfiguration,
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.paymentProviderConfigurations.findFirst({
			where: eq(paymentProviderConfigurations.id, id),
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
		PaymentProviderConfiguration,
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const tx = ctx.tx ?? ctx.db;
	const res = await ResultAsync.fromPromise(
		tx.query.paymentProviderConfigurations.findFirst({
			where: and(
				eq(paymentProviderConfigurations.projectId, projectId),
				eq(paymentProviderConfigurations.providerId, providerId),
				isNull(paymentProviderConfigurations.deletedAt)
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
