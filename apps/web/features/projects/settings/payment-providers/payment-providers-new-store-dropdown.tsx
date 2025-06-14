"use client";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@voidhash/ui";
import { PlusIcon } from "lucide-react";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import type { Project } from "@voidhash/db";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { createPaymentProviderConfigurationAction } from "@/lib/nextjs/server-actions";
import { useRouter } from "next/navigation";

export function PaymentProvidersNewStoreDropdown({
	project,
	organizationSlug,
	projectSlug,
}: {
	project: Project;
	organizationSlug: string;
	projectSlug: string;
}) {
	const router = useRouter();

	const { execute, isPending } = useAction(
		createPaymentProviderConfigurationAction,
		{
			onSuccess: (res) => {
				toast.success("Payment provider configuration created successfully");
				router.push(
					`/${organizationSlug}/${projectSlug}/settings/payment-providers/${res.data?.id}`
				);
			},
		}
	);

	const handleCreatePaymentProviderConfiguration = async (
		providerId: string
	) => {
		execute({
			providerId,
			projectId: project.id,
		});
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button>
						<PlusIcon className="w-4 h-4" />
						Add New Store
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-48" align="end">
					{paymentProviders
						.filter((p) => p.getType() === "native")
						.map((p) => (
							<DropdownMenuItem
								key={p.getId()}
								className="cursor-pointer"
								disabled={isPending}
								onClick={() => {
									handleCreatePaymentProviderConfiguration(p.getId());
								}}
							>
								{p.getTitle()}
							</DropdownMenuItem>
						))}
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
