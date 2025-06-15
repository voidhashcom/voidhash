"use client";

import {
	deletePaymentProviderConfigurationAction,
	updatePaymentProviderConfigurationAction,
} from "@/lib/nextjs/server-actions";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
	Project,
	ProjectPaymentProviderConfiguration,
} from "@voidhash/db";
import {
	Form,
	Label,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	Input,
	FormMessage,
	CopyText,
	Button,
	Card,
	Dropzone,
	useConfirmDialog,
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	Badge,
} from "@voidhash/ui";
import { CheckCircleIcon, EllipsisVerticalIcon, XIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { SubmitErrorHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PaymentProviderLogo } from "./payment-provider-logo";

export function PaymentProviderDetailConfiguration({
	organizationSlug,
	projectSlug,
	project,
	paymentProviderConfiguration,
}: {
	organizationSlug: string;
	projectSlug: string;
	project: Project;
	paymentProviderConfiguration: ProjectPaymentProviderConfiguration;
}) {
	const router = useRouter();

	const paymentProvider = paymentProviders.find(
		(pp) => pp.getId() === paymentProviderConfiguration.providerId
	)!;
	const [name, setName] = useState(paymentProviderConfiguration.name);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const form = useForm<any>({
		resolver: zodResolver(paymentProvider?.getGlobalConfigurationSchema()),
		defaultValues: paymentProviderConfiguration.configuration,
	});

	const { execute, isPending } = useAction(
		updatePaymentProviderConfigurationAction,
		{
			onSuccess: () => {
				toast.success(
					`${paymentProvider?.getTitle()} configuration saved successfully`
				);

				router.refresh();
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to save ${paymentProvider?.getTitle()} configuration. Please try again.`
				);
			},
		}
	);

	// Delete payment provider configuration
	const { ConfirmationDialog, openDialog } = useConfirmDialog();
	const { execute: deletePaymentProviderConfiguration, isPending: isDeleting } =
		useAction(deletePaymentProviderConfigurationAction, {
			onSuccess: () => {
				toast.success(
					`${paymentProvider?.getTitle()} configuration deleted successfully`
				);
				router.push(
					`/${organizationSlug}/${projectSlug}/settings/payment-providers`
				);
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to delete ${paymentProvider?.getTitle()} configuration. Please try again.`
				);
			},
		});

	const handleDeletePaymentProviderConfiguration = async (id: string) => {
		const res = await openDialog({
			title: "Delete payment provider",
			description: `Are you sure you want to delete this payment provider?`,
		});

		if (!res) {
			return;
		}

		deletePaymentProviderConfiguration({
			paymentProviderConfigurationId: id,
		});
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const onValidSubmit = async (
		data: z.infer<
			ReturnType<typeof paymentProvider.getGlobalConfigurationSchema>
		>
	) => {
		execute({
			id: paymentProviderConfiguration.id,
			enabled: paymentProviderConfiguration.enabled,
			name: name,
			configuration: data,
		});
	};

	const onInvalidSubmit: SubmitErrorHandler<
		z.infer<ReturnType<typeof paymentProvider.getGlobalConfigurationSchema>>
	> = (errors) => {
		// Log validation errors for debugging
		console.error("Form validation errors:", errors);
	};

	if (!paymentProvider) {
		return null;
	}

	if (!project) {
		return null;
	}

	const configurationSheet = paymentProvider.getGlobalConfigurationSheet({
		projectId: project.id,
	});

	const handleP8FileChange = (name: string, file: File) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			form.setValue(name, content);
		};
		reader.readAsText(file);
	};

	const handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void> = async (
		e
	) => {
		e?.preventDefault();

		const isValid = await form.trigger();
		const isCurrentlyEnabled = paymentProviderConfiguration.enabled;

		// Case 1: Form is invalid and provider is currently enabled
		if (!isValid && isCurrentlyEnabled) {
			const shouldContinue = await openDialog({
				title: "Invalid Configuration",
				description:
					"The current configuration is invalid. If you continue, the payment provider will be disabled. Do you want to proceed?",
			});

			if (!shouldContinue) {
				return;
			}

			// Submit with enabled set to false
			await form.handleSubmit((data) =>
				execute({
					id: paymentProviderConfiguration.id,
					enabled: false,
					name: name,
					configuration: data,
				})
			)(e);
			return;
		}

		// Case 2: Form is valid and provider is currently disabled
		if (isValid && !isCurrentlyEnabled) {
			const shouldEnable = (await openDialog({
				title: "Enable Payment Provider",
				description: "Would you like to enable this payment provider?",
			})) as boolean;

			// Submit with enabled based on user choice
			await form.handleSubmit((data) =>
				execute({
					id: paymentProviderConfiguration.id,
					enabled: shouldEnable,
					name: name,
					configuration: data,
				})
			)(e);
			return;
		}

		await form.handleSubmit(onValidSubmit, onInvalidSubmit)(e);
	};

	return (
		<Form {...form}>
			<form onSubmit={handleSubmit} className="flex flex-col flex-1">
				<div className="border-b border-border">
					<div className="max-w-5xl mx-auto pb-8">
						<div className="flex justify-between items-center">
							<div className="flex items-center gap-4">
								<PaymentProviderLogo
									providerId={
										paymentProviderConfiguration.providerId as ReturnType<
											(typeof paymentProviders)[number]["getId"]
										>
									}
									className="w-8 h-8"
								/>
								<h1 className="text-3xl font-normal tracking-right">
									{paymentProviderConfiguration.name}
								</h1>
								{paymentProviderConfiguration.enabled ? (
									<Badge variant="default">Enabled</Badge>
								) : (
									<Badge variant="outline">Disabled</Badge>
								)}
							</div>
							<div className="flex items-center gap-4">
								<Button type="submit" disabled={isPending}>
									{isPending ? "Saving..." : "Save changes"}
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="icon" className="z-20">
											<EllipsisVerticalIcon className="w-4 h-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-48" align="end">
										<DropdownMenuItem
											className="cursor-pointer"
											variant="destructive"
											disabled={isDeleting}
											onClick={(e) => {
												e.preventDefault();
												handleDeletePaymentProviderConfiguration(
													paymentProviderConfiguration.id
												);
											}}
										>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>

						{/* <Alert variant="success" className="mt-6 flex items-center">
							<div className="flex-1">
								<AlertTitle>This provider is correctly configured</AlertTitle>
								<AlertDescription>
									You can enable it to start tracking payments.
								</AlertDescription>
							</div>
							<Button variant="success">Enable</Button>
						</Alert> */}
					</div>
				</div>

				<div className="grid grid-cols-12 gap-6 flex-1 max-w-5xl mx-auto w-full">
					<div className="col-span-6"></div>
					<div className="col-span-6 border-l border-r border-border bg-card">
						<div className="px-4 pt-10 border-border">
							<h2 className="font-semibold text-lg tracking-tight">
								Configuration
							</h2>
						</div>
						<div className="w-full pt-6">
							<div className="flex-1 flex flex-col">
								<div>
									{form.formState.errors.root && (
										<div className="text-destructive">
											{form.formState.errors.root.message}
										</div>
									)}
								</div>

								<div className="px-4 flex-1 space-y-6 ">
									{paymentProvider.getType() === "native" && (
										<div>
											<Label htmlFor="name">Name</Label>
											<Input
												id="name"
												className="mt-2"
												value={name}
												onChange={(e) => setName(e.target.value)}
											/>
										</div>
									)}

									{configurationSheet?.sections.map((section) => (
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
													<div className="mt-2 p-3 bg-muted text-foreground rounded-md font-mono border border-input">
														<CopyText text={section.text} />
													</div>
												</div>
											)}
											{section.type === "p8-upload" && (
												<FormField
													control={form.control}
													name="privateKey"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Private Key (.p8 file)</FormLabel>
															<FormControl>
																{field.value ? (
																	<Card className="p-4 flex items-center justify-between gap-2 flex-row">
																		<div className="flex items-center gap-2">
																			<CheckCircleIcon className="w-4 h-4 text-green-500" />
																			<p className="text-sm text-muted-foreground">
																				Private key was successfully attached
																			</p>
																		</div>
																		<Button
																			variant="outline"
																			onClick={(e) => {
																				e.preventDefault();
																				field.onChange("");
																			}}
																		>
																			<XIcon className="w-4 h-4" />
																			<span>Remove</span>
																		</Button>
																	</Card>
																) : (
																	<Dropzone
																		onFileChange={(file) =>
																			handleP8FileChange(section.name, file)
																		}
																		accept=".p8"
																		maxSize={1024 * 1024} // 1MB
																	/>
																)}
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											)}
										</Fragment>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>

				<ConfirmationDialog />
			</form>
		</Form>
	);
}
