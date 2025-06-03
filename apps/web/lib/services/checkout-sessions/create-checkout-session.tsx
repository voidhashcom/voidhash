// import { generateId } from "@/lib/id/generate";
// import { ServiceContext } from "@/lib/service-function";
// import { db, checkoutSessions } from "@voidhash/db";
// import {
// 	fromUnknownThrow,
// 	VoidhashInternalServerError,
// } from "@voidhash/lib/constants";
// import { err, ok, Result } from "neverthrow";

// export async function createCheckoutSession({
// 	ctx,
// 	productId,
// 	customerId,
// }: {
// 	ctx: ServiceContext;
// 	productId: string;
// 	customerId: string;
// }): Promise<
// 	Result<
// 		{
// 			id: string;
// 			productId: string;
// 			customerId: string;
// 			createdAt: Date;
// 			updatedAt: Date;
// 		},
// 		VoidhashInternalServerError
// 	>
// > {
// 	const tx = ctx.tx ?? db;

// }
