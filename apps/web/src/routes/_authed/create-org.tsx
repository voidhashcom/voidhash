import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Logo,
	Label,
	Input,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@voidhash/ui";
import { toast } from "sonner";
import { z } from "zod";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { authClient } from "@voidhash/features/auth/lib/client";
import { useMutation } from "@tanstack/react-query";
import { createOrganizationMutation } from "@voidhash/features/organizations/server/mutations";
import {
	isVoidhashError,
	parseVoidhashError,
	VoidhashError,
} from "@voidhash/features/lib/errors";
import { authQueryKeys } from "@voidhash/features/auth/client/query-keys";

const createOrganizationSchema = z.object({
	name: z
		.string()
		.min(1, "Organization name is required")
		.max(32, "Organization name must be less than 32 characters"),
});

type CreateOrganizationForm = z.infer<typeof createOrganizationSchema>;

export const Route = createFileRoute("/_authed/create-org")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const context = Route.useRouteContext();

	const form = useForm<CreateOrganizationForm>({
		resolver: zodResolver(createOrganizationSchema),
		defaultValues: {
			name: "",
		},
	});

	const { mutate: createOrganization, isPending } = useMutation({
		mutationFn: createOrganizationMutation,
		onSuccess: (res) => {
			if (res?.id) {
				context.queryClient.invalidateQueries({
					queryKey: authQueryKeys.all,
				});
				navigate({
					to: "/~/$organizationSlug",
					params: { organizationSlug: res?.slug }, // This should be replaced with actual team ID
				});
			}
			navigate({
				to: "/",
			});
		},
		onError: (error) => {
			if (isVoidhashError(error)) {
				toast.error(parseVoidhashError(error));
			}
			toast.error("Failed to create team. Please try again.");
		},
	});

	const onSubmit = async (data: CreateOrganizationForm) => {
		createOrganization({
			data,
		});
	};

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<div className="flex justify-center">
						<Link to="/">
							<Logo />
						</Link>
					</div>
					<Card className="mt-4 text-center">
						<CardHeader>
							<CardTitle className="text-2xl">Welcome to voidhash</CardTitle>
							<CardDescription>
								Let's start by creating your new team.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(onSubmit)}
									className="space-y-6"
								>
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Team Name</FormLabel>
												<FormControl>
													<Input placeholder="Acme Inc." {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<Button type="submit" className="w-full" disabled={isPending}>
										{isPending ? "Creating Team..." : "Create Team"}
									</Button>
								</form>
							</Form>
							<div className="mt-6 text-sm text-muted-foreground">
								<p>
									Already have a team? Ask your team administrator to invite you
									using your email address.
								</p>
							</div>
						</CardContent>
					</Card>
					<div className="text-center text-sm text-muted-foreground">
						Signed in to a wrong account?{" "}
						<button className="underline underline-offset-4 text-foreground cursor-pointer">
							Logout
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
