"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@voidhash/auth/client";
import {
	Logo,
	Alert,
	AlertTitle,
	AlertDescription,
	Label,
	Input,
	Button,
} from "@voidhash/ui";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

function LoginPageContent() {
	const searchParams = useSearchParams();
	const router = useRouter();

	const [email, setEmail] = useState(searchParams.get("email") || "");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const signIn = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		const { error } = await authClient.signIn.email({
			email: email,
			password: password,
		});

		if (error) {
			toast.error(error.message ?? "An unknown error occurred");
			setLoading(false);
			return;
		}

		const next = searchParams.get("next");
		if (next) {
			router.push(decodeURIComponent(next));
		} else {
			router.push("/");
		}
	};

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 bg-surface-3 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link href="/" className="flex items-center gap-2 font-medium">
						<Logo />
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<form className="flex flex-col gap-6" onSubmit={signIn}>
							{searchParams.get("signup") === "true" && (
								<div className="mb-6">
									<Alert>
										<CheckCircle className="h-4 w-4" />
										<AlertTitle>
											Your account was successfully created
										</AlertTitle>
										<AlertDescription>
											You can now login to your account
										</AlertDescription>
									</Alert>
								</div>
							)}
							<div className="flex flex-col items-center gap-2 text-center">
								<h1 className="text-2xl font-bold">Login to your account</h1>
								<p className="text-balance text-sm text-muted-foreground">
									Enter your email below to login to your account
								</p>
							</div>
							<div className="grid gap-6">
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
									<div className="flex items-center">
										<Label htmlFor="password">Password</Label>
									</div>
									<Input
										id="password"
										type="password"
										required
										value={password}
										onChange={(e) => setPassword(e.target.value)}
									/>
								</div>
								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? "Loading..." : "Login"}
								</Button>
							</div>
							<div className="text-center text-sm">
								Don&apos;t have an account?{" "}
								<Link href="/sign-up" className="underline underline-offset-4">
									Sign up
								</Link>
							</div>
						</form>
					</div>
				</div>
			</div>
			<div className="bg-muted relative hidden lg:block">
				<img
					src="/images/circles-blur.jpg"
					alt="Image"
					className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
				/>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<LoginPageContent />
		</Suspense>
	);
}
