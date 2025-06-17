"use client";
import { createPaymentProviderConfigurationAction } from "@/lib/nextjs/server-actions";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { Button } from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function SetupPaymentProviderButton({
	projectId,
	providerId,
	organizationSlug,
	projectSlug,
}: {
	projectId: string;
	providerId: string;
	organizationSlug: string;
	projectSlug: string;
}) {
	const router = useRouter();

	const { execute, isPending } = useAction(
		createPaymentProviderConfigurationAction,
		{
			onSuccess: (res) => {
				toast.success(
					`${paymentProvider?.getTitle()} configuration saved successfully`
				);

				if (res.data?.id && paymentProvider?.getIsConfigurable()) {
					router.push(
						`/${organizationSlug}/${projectSlug}/settings/payment-providers/${res.data.id}`
					);
				} else {
					router.refresh();
				}
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to save ${paymentProvider?.getTitle()} configuration. Please try again.`
				);
			},
		}
	);

	const paymentProvider = paymentProviders.find(
		(p) => p.getId() === providerId
	);

	if (!paymentProvider) {
		return null;
	}

	return (
		<Button
			variant="outline"
			disabled={isPending}
			onClick={() =>
				execute({
					projectId: projectId,
					providerId: providerId,
				})
			}
		>
			Setup provider
		</Button>
	);
}
