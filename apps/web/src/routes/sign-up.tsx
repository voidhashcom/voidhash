import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { authClient } from "@voidhash/features/auth/lib/client";

const signUpSchema = z
	.object({
		name: z.string().min(2, "Name must be at least 2 characters"),
		email: z.string().email("Please enter a valid email address"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
				"Password must contain at least one uppercase letter, one lowercase letter, and one number"
			),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type SignUpForm = z.infer<typeof signUpSchema>;

export const Route = createFileRoute("/sign-up")({
	component: RouteComponent,
});

function RouteComponent() {
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const form = useForm<SignUpForm>({
		resolver: zodResolver(signUpSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	});

	const onSubmit = async (data: SignUpForm) => {
		await authClient.signUp.email(
			{
				email: data.email,
				password: data.password,
				name: data.name,
			},
			{
				onRequest: (ctx) => {
					setLoading(true);
				},
				onSuccess: (ctx) => {
					navigate({
						to: "/login",
						search: { email: data.email, signup: true },
					});
				},
				onError: (ctx) => {
					console.log(ctx);
					toast.error(ctx.error.message);
					setLoading(false);
				},
			}
		);
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
					<Card className="mt-4">
						<CardHeader>
							<CardTitle className="text-2xl">Create an Account</CardTitle>
							<CardDescription>
								Enter your details below to create your account
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
												<FormLabel>Name</FormLabel>
												<FormControl>
													<Input placeholder="John Doe" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<Input
														placeholder="name@example.com"
														type="email"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="password"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Password</FormLabel>
												<FormControl>
													<Input type="password" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="confirmPassword"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Confirm Password</FormLabel>
												<FormControl>
													<Input type="password" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? "Loading..." : "Sign Up"}
									</Button>
								</form>
							</Form>
							<div className="mt-4 text-center text-sm">
								Already have an account?{" "}
								<Link
									to="/login"
									search={{ signup: false }}
									className="underline underline-offset-4"
								>
									Login
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
