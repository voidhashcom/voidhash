import {
	customers,
	customersUnlockedPerks,
	externalCustomerIdentifiers,
} from "@voidhash/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getCustomersQuery = async (
	ctx: ServiceContext,
	projectId: string,
	filters: {
		hasAppUserId: boolean | null;
	}
) => {
	const customerList = await ctx.db
		.select()
		.from(customers)
		.where(
			and(
				eq(customers.projectId, projectId),
				filters.hasAppUserId !== null
					? filters.hasAppUserId
						? isNotNull(customers.appUserId)
						: isNull(customers.appUserId)
					: undefined
			)
		);
	return customerList;
};

export const getCustomerByIdQuery = async (
	ctx: ServiceContext,
	customerId: string
) => {
	const res = await ctx.db
		.select()
		.from(customers)
		.where(eq(customers.id, customerId));
	return res[0];
};

export const getCustomerByAppUserIdQuery = async (
	ctx: ServiceContext,
	appUserId: string
) => {
	const res = await ctx.db
		.select()
		.from(customers)
		.where(eq(customers.appUserId, appUserId));

	return res[0];
};

export const getCustomerByExternalIdentifierQuery = async (
	ctx: ServiceContext,
	projectId: string,
	serviceId: string,
	identifier: string
) => {
	const res = await ctx.db
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
		);
	return res[0]?.customer;
};

export const getCustomersUnlockedPerksQuery = async (
	ctx: ServiceContext,
	customerId: string
) => {
	const res = await ctx.db.query.customersUnlockedPerks.findMany({
		where: eq(customersUnlockedPerks.customerId, customerId),
	});
	return res;
};
