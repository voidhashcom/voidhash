import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "src/lib/auth-client";
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
} from "@chiron-standalone/ui";
import { toast } from "sonner";

import { useState } from "react";

export const Route = createFileRoute("/sign-up")({
	component: RouteComponent,
});

function RouteComponent() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const navigate = useNavigate();

	const signUp = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (password !== confirmPassword) {
			alert("Passwords do not match");
			return;
		}

		await authClient.signUp.email(
			{
				email,
				password,
				name,
			},
			{
				onRequest: (ctx) => {
					setLoading(true);
				},
				onSuccess: (ctx) => {
					navigate({ to: "/login", search: { email, signup: true } });
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
							<form onSubmit={signUp}>
								<div className="flex flex-col gap-6">
									<div className="grid gap-2">
										<Label htmlFor="name">Name</Label>
										<Input
											id="name"
											type="text"
											placeholder="John Doe"
											required
											value={name}
											onChange={(e) => setName(e.target.value)}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											placeholder="name@example.com"
											required
											value={email}
											onChange={(e) => setEmail(e.target.value)}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="password">Password</Label>
										<Input
											id="password"
											type="password"
											required
											value={password}
											onChange={(e) => setPassword(e.target.value)}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="confirm-password">Confirm Password</Label>
										<Input
											id="confirm-password"
											type="password"
											required
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
										/>
									</div>
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? "Loading..." : "Sign Up"}
									</Button>
								</div>
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
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
