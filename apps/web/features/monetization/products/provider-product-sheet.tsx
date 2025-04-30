"use client";

import {
	createPaymentProviderProductAction,
	updatePaymentProviderProductAction,
} from "@/lib/nextjs/server-actions";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Form,
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	Label,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	Input,
	FormMessage,
	CopyText,
	SheetFooter,
	Button,
} from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Fragment, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

export function ProviderProductSheet({
	open,
	onClose,
	productId,
	providerId,
	providerProductKey,
	configuration,
	mode,
}: {
	open: boolean;
	onClose: () => void;
	productId: string;
	providerId: string;
	providerProductKey?: string;
	mode: "add" | "edit";
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	configuration?: any;
}) {
	const router = useRouter();
	const paymentProvider = paymentProviders.find((pp) => pp.id === providerId);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const form = useForm<any>({
		resolver: zodResolver(
			paymentProvider?.products.productConfigurationSchema ?? z.object({})
		),
		defaultValues: paymentProvider?.products.defaultProductConfiguration,
	});

	const { execute: create, isPending: createPending } = useAction(
		createPaymentProviderProductAction,
		{
			onSuccess: () => {
				toast.success(
					`${paymentProvider?.title} configuration saved successfully`
				);
				onClose();
				router.refresh();
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to save ${paymentProvider?.title} configuration. Please try again.`
				);
			},
		}
	);

	const { execute: update, isPending: updatePending } = useAction(
		updatePaymentProviderProductAction,
		{
			onSuccess: () => {
				toast.success(
					`${paymentProvider?.title} configuration saved successfully`
				);
				onClose();
				router.refresh();
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to save ${paymentProvider?.title} configuration. Please try again.`
				);
			},
		}
	);

	const isPending = createPending || updatePending;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const onSubmit = async (data: any) => {
		if (mode === "add") {
			create({
				providerId: providerId,
				productId: productId,
				configuration: data,
			});
		} else {
			if (!providerProductKey) {
				toast.error("An error occurred while saving the configuration");
				return;
			}
			update({
				providerId: providerId,
				productId: productId,
				providerProductKey: providerProductKey,
				configuration: data,
			});
		}
	};

	useEffect(() => {
		if (open) {
			form.reset(
				configuration ??
					paymentProvider?.products.defaultProductConfiguration ??
					{}
			);
		}
	}, [open]);

	if (!paymentProvider) {
		return null;
	}

	const configurationSheet = paymentProvider.products.createProductEditorSheet({
		productId: productId,
	});

	return (
		<Sheet
			open={open}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<SheetContent className="sm:max-w-2xl">
				<SheetHeader>
					<SheetTitle>
						{mode === "add"
							? `Add ${paymentProvider?.title} Product`
							: `Edit ${paymentProvider?.title} Product`}
					</SheetTitle>
				</SheetHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="flex-1 flex flex-col"
					>
						<div>
							{form.formState.errors.root && (
								<div className="text-destructive">
									{form.formState.errors.root.message}
								</div>
							)}
						</div>

						<div className="px-4 flex-1 space-y-6 ">
							{configurationSheet.sections.map((section) => (
								<Fragment key={section.key}>
									{section.type === "text-input" && (
										<FormField
											control={form.control}
											name={section.name}
											render={({ field }) => (
												<FormItem>
													<FormLabel>{section.label}</FormLabel>
													<FormControl>
														<Input
															type={section.input.type}
															placeholder={section.input.placeholder}
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									)}
									{section.type === "copy-text" && (
										<div className="mt-4">
											<Label>{section.label}</Label>
											<div className="mt-2 p-3 bg-muted rounded-md">
												<CopyText text={section.text} />
											</div>
										</div>
									)}
								</Fragment>
							))}
						</div>
						<SheetFooter className="flex gap-2 justify-end flex-row border-t border-border">
							<div className="flex gap-2 justify-end flex-row">
								<Button
									variant="outline"
									onClick={(e) => {
										e.preventDefault();
										onClose();
									}}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isPending}>
									{isPending ? "Saving..." : mode === "add" ? "Add" : "Save"}
								</Button>
							</div>
						</SheetFooter>
					</form>
				</Form>
			</SheetContent>
		</Sheet>
	);
}
