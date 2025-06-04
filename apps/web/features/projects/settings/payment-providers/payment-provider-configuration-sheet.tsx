"use client";

import { savePaymentProviderConfigurationAction } from "@/lib/nextjs/server-actions";
import { paymentProviders } from "@/lib/payment-providers/paymentProviders";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Project } from "@voidhash/db";
import {
	Form,
	Sheet,
	SheetTrigger,
	SheetContent,
	SheetHeader,
	SheetTitle,
	Switch,
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
	Card,
	Dropzone,
} from "@voidhash/ui";
import { CheckCircleIcon, XIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

export function PaymentProviderConfigurationSheet({
	trigger,
	providerId,
	enabled,
	configuration,
	project,
}: {
	trigger: React.ReactNode;
	providerId: string;
	enabled: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	configuration?: any;
	project: Project;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [isEnabled, setIsEnabled] = useState(enabled);
	const paymentProvider = paymentProviders.find(
		(pp) => pp.getId() === providerId
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const form = useForm<any>({
		resolver: isEnabled
			? zodResolver(
					paymentProvider?.getGlobalConfigurationSchema() ?? z.object({})
				)
			: undefined,
		defaultValues: paymentProvider?.getDefaultGlobalConfiguration(),
	});

	const { execute, isPending } = useAction(
		savePaymentProviderConfigurationAction,
		{
			onSuccess: () => {
				toast.success(
					`${paymentProvider?.getTitle()} configuration saved successfully`
				);
				setOpen(false);
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

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const onSubmit = async (data: any) => {
		execute({
			providerId: providerId,
			projectId: project?.id ?? "",
			enabled: isEnabled,
			configuration: data,
		});
	};

	useEffect(() => {
		if (open) {
			form.reset(
				configuration ?? paymentProvider?.getDefaultGlobalConfiguration()
			);
			setIsEnabled(enabled);
		}
	}, [open]);

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

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>{trigger}</SheetTrigger>
			<SheetContent className="sm:max-w-2xl">
				<SheetHeader>
					<SheetTitle>{paymentProvider.getTitle()} Configuration</SheetTitle>
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
							<div className="flex items-center gap-6">
								<Switch
									checked={isEnabled}
									id="enabled"
									onCheckedChange={setIsEnabled}
								/>

								<Label htmlFor="enabled">
									{paymentProvider.getTitle()} enabled
								</Label>
							</div>

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
											<div className="mt-2 p-3 bg-muted rounded-md">
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
						<SheetFooter className="flex gap-2 justify-end flex-row border-t border-border">
							<Button
								variant="outline"
								onClick={(e) => {
									e.preventDefault();
									setOpen(false);
								}}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Saving..." : "Save"}
							</Button>
						</SheetFooter>
					</form>
				</Form>
			</SheetContent>
		</Sheet>
	);
}
