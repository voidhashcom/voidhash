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
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { type getProjectById } from "@/lib/services/projects/queries";
import { savePaymentProviderConfigurationAction } from "@/lib/nextjs/server-actions";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { stripe } from "@/lib/payment-providers/stripe/stripe";

type StripeConfigurationForm = z.infer<typeof stripe.configurationSchema>;

export function StripeConfigurationSheet({
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

	const form = useForm<StripeConfigurationForm>({
		resolver: isEnabled ? zodResolver(stripe.configurationSchema) : undefined,
		defaultValues: stripe.defaultConfiguration,
	});

	const { execute, isPending } = useAction(
		savePaymentProviderConfigurationAction,
		{
			onSuccess: () => {
				toast.success("Stripe configuration saved successfully");
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

	const onSubmit = async (data: StripeConfigurationForm) => {
		execute({
			providerId: stripe.id,
			projectId: project?.id ?? "",
			enabled: isEnabled,
			configuration: data,
		});
	};

	useEffect(() => {
		if (open) {
			form.reset(configuration ?? stripe.defaultConfiguration);
			setIsEnabled(enabled);
		}
	}, [open]);

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
