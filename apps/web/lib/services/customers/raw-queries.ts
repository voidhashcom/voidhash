import { customer, externalCustomerIdentifier } from "@voidhash/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getCustomersQuery = async (
	ctx: ServiceContext,
	projectId: string,
	filters: {
		hasAppUserId: boolean | null;
	}
) => {
	const customers = ctx.db
		.select()
		.from(customer)
		.where(
			and(
				eq(customer.projectId, projectId),
				filters.hasAppUserId !== null
					? filters.hasAppUserId
						? isNotNull(customer.appUserId)
						: isNull(customer.appUserId)
					: undefined
			)
		);
	return customers;
};

export const getCustomerByAppUserIdQuery = async (
	ctx: ServiceContext,
	appUserId: string
) => {
	const res = await ctx.db
		.select()
		.from(customer)
		.where(eq(customer.appUserId, appUserId));

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
		.from(customer)
		.innerJoin(
			externalCustomerIdentifier,
			eq(customer.id, externalCustomerIdentifier.customerId)
		)
		.where(
			and(
				eq(customer.projectId, projectId),
				eq(externalCustomerIdentifier.serviceId, serviceId),
				eq(externalCustomerIdentifier.identifier, identifier)
			)
		);
	return res[0]?.customer;
};
