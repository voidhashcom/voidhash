"use client";

import { Button } from "@voidhash/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@voidhash/ui/dialog";
import { Input } from "@voidhash/ui/input";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@voidhash/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { createPaywallLocationAction } from "@/lib/nextjs/server-actions";
import { useRouter } from "next/navigation";
import { InferSafeActionFnResult } from "next-safe-action";
import {
	cn,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	InfoTooltip,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@voidhash/ui";
import { type getPaywalls } from "@/lib/services/paywalls/queries";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect } from "react";

const createPaywallLocationSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
	slug: z
		.string()
		.min(3, "Slug must be at least 3 characters long")
		.max(32, "Slug must be less than 32 characters")
		.regex(
			/^[a-z0-9_-]+$/,
			"Slug must contain only lowercase letters, numbers, underscores, and hyphens"
		),
	defaultPaywallId: z.string().min(1, "Default paywall is required"),
});

type CreatePaywallLocationForm = z.infer<typeof createPaywallLocationSchema>;
type PaywallLocation = InferSafeActionFnResult<
	typeof createPaywallLocationAction
>["data"];

interface CreatePaywallLocationModalProps {
	open: boolean;
	onClose: () => void;
	paywalls: Awaited<ReturnType<typeof getPaywalls>>;
	trigger: React.ReactNode;
	projectId: string;
	onSuccess?: (paywallLocation: PaywallLocation) => void;
}

export function CreatePaywallLocationModal({
	open,
	onClose,
	trigger,
	paywalls,
	projectId,
	onSuccess,
}: CreatePaywallLocationModalProps) {
	const router = useRouter();
	const form = useForm<CreatePaywallLocationForm>({
		resolver: zodResolver(createPaywallLocationSchema),
		defaultValues: {
			name: "",
			slug: "",
			defaultPaywallId: paywalls[0]?.id || "",
		},
	});

	const { execute, isPending } = useAction(createPaywallLocationAction, {
		onSuccess: (res) => {
			if (res.data) {
				toast.success("Paywall location created successfully");
				onSuccess?.(res.data);
				router.refresh();
				handleOpenChange(false);
			}
		},
		onError: (error) => {
			toast.error(
				error.error.serverError || "Failed to create paywall location"
			);
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
			form.reset();
		}
	};

	const onSubmit = (data: CreatePaywallLocationForm) => {
		execute({ ...data, projectId });
	};

	useEffect(() => {
		if (paywalls.length > 0) {
			form.setValue("defaultPaywallId", paywalls[0]?.id || "");
		}
	}, [paywalls, form]);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create Paywall Location</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 pt-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem className="space-y-1">
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input
											placeholder="Onboarding, Feature X locked, etc."
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="slug"
							render={({ field }) => (
								<FormItem className="space-y-1">
									<FormLabel>
										<span>Slug (ID)</span>
										<InfoTooltip
											info={
												"Slugs are unique identifiers used to reference the paywall location in code."
											}
										/>
									</FormLabel>
									<FormControl>
										<Input
											placeholder="onboarding, feature-x-locked, etc."
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="defaultPaywallId"
							render={({ field }) => (
								<FormItem className="space-y-1">
									<FormLabel>
										Paywall{" "}
										<InfoTooltip info="The paywall that will be shown on this location." />
									</FormLabel>
									<FormControl>
										<Popover>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														variant="outline"
														role="combobox"
														className={cn(
															"justify-between",
															!field.value && "text-muted-foreground"
														)}
													>
														{field.value
															? paywalls.find(
																	(paywall) => paywall.id === field.value
																)?.name
															: "Select paywall"}
														<ChevronsUpDown className="opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="w-[300px] p-0" align="start">
												<Command>
													<CommandInput
														placeholder="Search paywall..."
														className="h-9"
													/>
													<CommandList>
														<CommandEmpty>No paywalls found.</CommandEmpty>
														<CommandGroup>
															{paywalls.map((paywall) => (
																<CommandItem
																	value={paywall.name}
																	key={paywall.id}
																	className="cursor-pointer"
																	onSelect={() => {
																		form.setValue(
																			"defaultPaywallId",
																			paywall.id
																		);
																	}}
																>
																	{paywall.name}
																	<Check
																		className={cn(
																			"ml-auto",
																			paywall.id === field.value
																				? "opacity-100"
																				: "opacity-0"
																		)}
																	/>
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</Popover>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<DialogFooter>
							<Button
								type="submit"
								disabled={isPending}
								className="w-full mt-4"
							>
								{isPending
									? "Creating Paywall Location..."
									: "Create Paywall Location"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
