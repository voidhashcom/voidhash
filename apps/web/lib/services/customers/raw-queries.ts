import {
	Customer,
	customers,
	customersUnlockedPerks,
	CustomerUnlockedPerk,
	externalCustomerIdentifiers,
} from "@voidhash/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { err, ok, Result, ResultAsync } from "neverthrow";

export const getCustomersQuery = async (
	ctx: ServiceContext,
	projectId: string,
	filters: {
		hasAppUserId: boolean | null;
	}
): Promise<Result<Customer[], VoidhashInternalServerError>> => {
	const customerList = await ResultAsync.fromPromise(
		ctx.db.query.customers.findMany({
			where: and(
				eq(customers.projectId, projectId),
				filters.hasAppUserId !== null
					? filters.hasAppUserId
						? isNotNull(customers.appUserId)
						: isNull(customers.appUserId)
					: undefined
			),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (customerList.isErr()) {
		return err(customerList.error);
	}
	return ok(customerList.value);
};

export const getCustomerByIdQuery = async (
	ctx: ServiceContext,
	customerId: string
): Promise<
	Result<Customer, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.customers.findFirst({
			where: eq(customers.id, customerId),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Customer not found",
			resource: "customer",
			payload: {
				id: customerId,
			},
		});
	}
	return ok(res.value);
};

export const getCustomerByAppUserIdQuery = async (
	ctx: ServiceContext,
	appUserId: string
): Promise<
	Result<Customer, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.customers.findFirst({
			where: eq(customers.appUserId, appUserId),
		}),
		(e) => fromUnknownThrow(e)
	);

	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Customer not found",
			resource: "customer",
			payload: {
				appUserId,
			},
		});
	}
	return ok(res.value);
};

export const getCustomerByExternalIdentifierQuery = async (
	ctx: ServiceContext,
	projectId: string,
	serviceId: string,
	identifier: string
): Promise<
	Result<Customer, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db
			.select()
			.from(customers)
			.innerJoin(
				externalCustomerIdentifiers,
				eq(customers.id, externalCustomerIdentifiers.customerId)
			)
			.where(
				and(
					eq(customers.projectId, projectId),
					eq(externalCustomerIdentifiers.serviceId, serviceId),
					eq(externalCustomerIdentifiers.identifier, identifier)
				)
			),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	const customer = res.value[0]?.customer;
	if (!customer) {
		return err({
			code: "NOT_FOUND",
			message: "Customer not found",
			resource: "customer",
			payload: {},
		});
	}
	return ok(customer);
};

export const getCustomersUnlockedPerksQuery = async (
	ctx: ServiceContext,
	customerId: string
): Promise<Result<CustomerUnlockedPerk[], VoidhashInternalServerError>> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.customersUnlockedPerks.findMany({
			where: eq(customersUnlockedPerks.customerId, customerId),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value);
};
