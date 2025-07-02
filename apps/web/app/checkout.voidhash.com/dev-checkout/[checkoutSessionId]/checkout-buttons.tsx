"use client";

// import {
// 	cancelDevCheckoutPurchaseAction	,
// 	confirmDevCheckoutPurchaseAction,
// } from "@/lib/nextjs/server-actions";
import { Button } from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";

export function CheckoutButtons({
	checkoutSessionId,
}: {
	checkoutSessionId: string;
}) {
	// const { execute: handleConfirm, isExecuting: isConfirming } = useAction(
	// 	confirmDevCheckoutPurchaseAction,
	// 	{
	// 		onSuccess: (data) => {
	// 			window.location.replace(
	// 				`${data?.data ?? ""}?checkoutSessionId=${checkoutSessionId}&success=true`
	// 			);
	// 		},
	// 		onError: (error) => {
	// 			console.log(error);
	// 		},
	// 	}
	// );

	// const { execute: handleCancel, isExecuting: isCancelling } = useAction(
	// 	cancelDevCheckoutPurchaseAction,
	// 	{
	// 		onSuccess: (data) => {
	// 			window.location.replace(
	// 				`${data?.data ?? ""}?checkoutSessionId=${checkoutSessionId}&error=cancelled`
	// 			);
	// 		},
	// 		onError: (error) => {
	// 			console.log(error);
	// 		},
	// 	}
	// );



	return (
		<>
			{/* <Button
				onClick={() => handleConfirm({ checkoutSessionId })}
				className="w-full"
				disabled={isConfirming}
			>
				{isConfirming ? "Confirming..." : "Confirm Purchase"}
			</Button>

			<Button
				onClick={() => handleCancel({ checkoutSessionId })}
				variant="outline"
				className="w-full"
				disabled={isCancelling}
			>
				{isCancelling ? "Cancelling..." : "Cancel"}
			</Button> */}
		</>
	);
}
