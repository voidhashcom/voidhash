"use client";
import {
	Logo,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { authClient } from "@voidhash/auth/client";
import { createOrganizationAction } from "@/lib/nextjs/server-actions";

const createOrganizationSchema = z.object({
	name: z
		.string()
		.min(1, "Organization name is required")
		.max(32, "Organization name must be less than 32 characters"),
});

type CreateOrganizationForm = z.infer<typeof createOrganizationSchema>;

export default function CreateOrgPage() {
	const router = useRouter();

	const form = useForm<CreateOrganizationForm>({
		resolver: zodResolver(createOrganizationSchema),
		defaultValues: {
			name: "",
		},
	});

	const queryClient = useQueryClient();

	const { execute, isPending } = useAction(createOrganizationAction, {
		onSuccess: (res) => {
			queryClient.invalidateQueries();
			router.push(`/${res.data?.slug}`);
		},
		onError: (error) => {
			toast.error(error.error.serverError);
		},
	});

	const onSubmit = async (data: CreateOrganizationForm) => {
		execute(data);
	};

	// Sign out
	const signOut = async () => {
		await authClient.signOut();
		router.refresh();
		router.push("/");
	};

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<div className="flex justify-center">
						<Link href="/">
							<Logo />
						</Link>
					</div>
					<Card className="mt-4 text-center">
						<CardHeader>
							<CardTitle className="text-2xl">Welcome to Voidhash</CardTitle>
							<CardDescription>
								Let&apos;s start by creating your new team.
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
						<button
							className="underline underline-offset-4 text-foreground cursor-pointer"
							onClick={signOut}
						>
							Logout
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
