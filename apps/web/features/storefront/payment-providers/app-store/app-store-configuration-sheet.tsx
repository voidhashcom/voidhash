"use client";
import {
	Sheet,
	SheetTrigger,
	SheetContent,
	SheetHeader,
	SheetTitle,
	Switch,
	Label,
	Form,
	Button,
	SheetFooter,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	Dropzone,
	Card,
} from "@voidhash/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircleIcon, XIcon } from "lucide-react";
import { type getProjectById } from "@/lib/services/projects/queries";
import { appStore } from "@/lib/payment-providers/app-store/app-store";
import { useAction } from "next-safe-action/hooks";
import { savePaymentProviderConfigurationAction } from "@/lib/nextjs/server-actions";
import { useRouter } from "next/navigation";

const INTEGRATION_ID = appStore.id;

type AppStoreConfigurationForm = z.infer<typeof appStore.configurationSchema>;

export function AppStoreConfigurationSheet({
	trigger,
	enabled,
	configuration,
	project,
}: {
	trigger: React.ReactNode;
	enabled: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	configuration?: any;
	project: Awaited<ReturnType<typeof getProjectById>>;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	const [isEnabled, setIsEnabled] = useState(enabled);

	const form = useForm<AppStoreConfigurationForm>({
		resolver: isEnabled ? zodResolver(appStore.configurationSchema) : undefined,
		defaultValues: appStore.defaultConfiguration,
	});

	const { execute, isPending } = useAction(
		savePaymentProviderConfigurationAction,
		{
			onSuccess: () => {
				toast.success("App Store configuration saved successfully");
				setOpen(false);
				router.refresh();
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						"Failed to save configuration. Please try again."
				);
			},
		}
	);

	const onSubmit = async (data: AppStoreConfigurationForm) => {
		execute({
			providerId: INTEGRATION_ID,
			projectId: project?.id ?? "",
			enabled: isEnabled,
			configuration: data,
		});
	};

	const handleOpenChange = (open: boolean) => {
		setOpen(open);
	};

	const handleFileChange = (file: File) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			form.setValue("privateKey", content);
		};
		reader.readAsText(file);
	};

	useEffect(() => {
		if (open) {
			form.reset(configuration ?? appStore.defaultConfiguration);
			setIsEnabled(enabled);
		}
	}, [open]);

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetTrigger asChild>{trigger}</SheetTrigger>
			<SheetContent className="sm:max-w-2xl">
				<SheetHeader>
					<SheetTitle>App Store Configuration</SheetTitle>
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

								<Label htmlFor="enabled">App Store enabled</Label>
							</div>

							<FormField
								control={form.control}
								name="bundleId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Bundle ID</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="com.example.app"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="issuerId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Issuer ID</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="00000000-0000-0000-0000-000000000000"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="keyId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Key ID</FormLabel>
										<FormControl>
											<Input type="text" placeholder="XXXXXXXXXX" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

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
													onFileChange={handleFileChange}
													accept=".p8"
													maxSize={1024 * 1024} // 1MB
												/>
											)}
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
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
