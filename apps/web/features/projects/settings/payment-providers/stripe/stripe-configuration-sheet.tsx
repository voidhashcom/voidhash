"use client";
import {
	Sheet,
	SheetTrigger,
	SheetContent,
	SheetHeader,
	SheetTitle,
	Switch,
	Label,
	Input,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Button,
	SheetFooter,
	CopyText,
} from "@voidhash/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { stripe } from "./stripe";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "../../../../shell/hooks/useActiveProject";
import { useTRPC } from "../../../../trpc/react";

type StripeConfigurationForm = z.infer<typeof stripe.configurationSchema>;

export function StripeConfigurationSheet({
	trigger,
	enabled,
	configuration,
}: {
	trigger: React.ReactNode;
	enabled: boolean;
	configuration?: any;
}) {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const { activeProject } = useActiveProject();
	const [isEnabled, setIsEnabled] = useState(enabled);

	const form = useForm<StripeConfigurationForm>({
		resolver: isEnabled ? zodResolver(stripe.configurationSchema) : undefined,
		defaultValues: {
			secretKey: configuration?.secretKey ?? "",
			webhookSecret: configuration?.webhookSecret ?? "",
		},
	});

	const trpc = useTRPC();

	const { mutate: saveConfiguration, isPending } = useMutation(
		trpc.paymentProviders.savePaymentProviderConfiguration.mutationOptions({
			onSuccess: async () => {
				toast.success("Stripe configuration saved successfully");
				setOpen(false);
				queryClient.invalidateQueries({
					queryKey:
						trpc.paymentProviders.paymentProvidersConfigurations.queryKey(),
				});
			},
			onError: (error) => {
				if (error.data?.voidhashError) {
					toast.error(error.data.voidhashError.message);
				} else {
					toast.error("Failed to save Stripe configuration. Please try again.");
				}
			},
		})
	);

	const onSubmit = async (data: StripeConfigurationForm) => {
		console.log({
			providerId: stripe.id,
			projectId: activeProject?.id ?? "",
			enabled: isEnabled,
			configuration: data,
		});
		saveConfiguration({
			providerId: stripe.id,
			projectId: activeProject?.id ?? "",
			enabled: isEnabled,
			configuration: data,
		});
	};

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>{trigger}</SheetTrigger>
			<SheetContent className="sm:max-w-2xl">
				<SheetHeader>
					<SheetTitle>Stripe Configuration</SheetTitle>
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

								<Label htmlFor="enabled">Stripe enabled</Label>
							</div>

							<FormField
								control={form.control}
								name="secretKey"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Secret Key</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="sk_test_..."
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="webhookSecret"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Webhook Secret</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="whsec_..."
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="mt-4">
								<Label>Webhook URL</Label>
								<div className="mt-2 p-3 bg-muted rounded-md">
									<CopyText text={`https://api.voidhash.com/webhooks/stripe`} />
									{/* <code className="text-sm">
										https://api.voidhash.com/webhooks/stripe
									</code> */}
								</div>
							</div>
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
