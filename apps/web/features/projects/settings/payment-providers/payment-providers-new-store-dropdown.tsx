"use client";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@voidhash/ui";
import { PlusIcon } from "lucide-react";
import { PaymentProviderConfigurationSheet } from "./payment-provider-configuration-sheet";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import type { Project } from "@voidhash/db";
import { useState } from "react";
import { PaymentProvider } from "@/lib/services/payment-providers/core/payment-provider";

export function PaymentProvidersNewStoreDropdown({
	project,
}: { project: Project }) {
	const [open, setOpen] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<PaymentProvider<
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		any
	> | null>(null);

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
								onClick={() => {
									console.log("opening");
									setSelectedProvider(p);
									setOpen(true);
								}}
							>
								{p.getTitle()}
							</DropdownMenuItem>
						))}
				</DropdownMenuContent>
			</DropdownMenu>
			<PaymentProviderConfigurationSheet
				open={open}
				onOpenChange={setOpen}
				key={selectedProvider?.getId()}
				providerId={selectedProvider?.getId()}
				enabled={true}
				configuration={null}
				project={project}
				name={selectedProvider?.getTitle() ?? ""}
			/>
		</>
	);
}
