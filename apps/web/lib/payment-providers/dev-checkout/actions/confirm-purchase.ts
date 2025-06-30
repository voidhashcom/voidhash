// import { createServiceFunction } from "@/lib/service-function";
// import { z } from "zod";
// import {
// 	VoidhashBadRequestError,
// 	VoidhashInternalServerError,
// 	VoidhashNotFoundError,
// } from "@voidhash/lib";
// import { err, ok, Result } from "neverthrow";
// import { createDevCheckoutPaymentProviderServer } from "../dev-checout-server";

// export const confirmDevCheckoutPurchaseInputSchema = z.object({
// 	checkoutSessionId: z.string(),
// });
// export const confirmDevCheckoutPurchase = createServiceFunction()
// 	.input(confirmDevCheckoutPurchaseInputSchema)
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
// 			const result = await devCheckoutServer.confirmPurchase(ctx, input);

// 			if (result.isErr()) {
// 				return err(result.error);
// 			}

// 			return ok(result.value.redirectUrl);
// 		}
// 	);
