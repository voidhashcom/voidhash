// import { createServiceFunction } from "@/lib/service-function";
// import { z } from "zod";
// import {
// 	VoidhashBadRequestError,
// 	VoidhashInternalServerError,
// 	VoidhashNotFoundError,
// } from "@voidhash/lib";
// import { err, ok, Result } from "neverthrow";
// import { createDevCheckoutPaymentProviderServer } from "../dev-checout-server";

// export const cancelDevCheckoutPurchaseInputSchema = z.object({
// 	checkoutSessionId: z.string(),
// });
// export const cancelDevCheckoutPurchase = createServiceFunction()
// 	.input(cancelDevCheckoutPurchaseInputSchema)
// 	.function(
// 		async ({
// 			input,
// 			ctx,
// 		}): Promise<
// 			Result<
// 				string,
// 				| VoidhashInternalServerError
// 				| VoidhashNotFoundError
// 				| VoidhashBadRequestError
// 			>
// 		> => {
// 			const devCheckoutServer = createDevCheckoutPaymentProviderServer();
// 			const result = await devCheckoutServer.cancelPurchase(ctx, input);

// 			if (result.isErr()) {
// 				return err(result.error);
// 			}

// 			return ok(result.value.redirectUrl);
// 		}
// 	);
