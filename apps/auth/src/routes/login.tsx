import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { authClient } from "@voidhash/auth/client";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	Input,
	Label,
	Logo,
} from "@voidhash/ui";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const loginSearchSchema = z.object({
	email: z.string().default(""),
	next: z.string().optional(),
	signup: z.boolean().default(false),
});

export const Route = createFileRoute("/login")({
	component: LoginPage,
	validateSearch: zodValidator(loginSearchSchema),
});

// import { LoginPageIllustration } from "@/features/auth/components/login-page-illustration";

export function LoginPage() {
	const searchParams = Route.useSearch();
	const navigate = Route.useNavigate();

	const [email, setEmail] = useState(searchParams.email ?? "");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const signIn = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const { error } = await authClient.signIn.email({
				email,
				password,
			});

			if (error) {
				setLoading(false);
				toast.error(error.message ?? "An unknown error occurred");
				return;
			}

			const next = searchParams.next;
			if (next && next.length > 1) {
				navigate({ to: next });
			} else {
				navigate({ to: "/" });
			}
		} catch (_error) {
			setLoading(false);
			toast.error("An unknown error occurred. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="grid min-h-svh bg-background lg:grid-cols-2">
			<div className="flex flex-col gap-4 bg-background p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link className="flex items-center gap-2 font-medium" href="/login">
						<Logo />
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<form className="flex flex-col gap-6" onSubmit={signIn}>
							{searchParams.signup && (
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
								<h1 className="font-bold text-2xl">Login to your account</h1>
								<p className="text-balance text-muted-foreground text-sm">
									Enter your email below to login to your account
								</p>
							</div>
							<div className="grid gap-6">
								<div className="flex flex-col gap-4">
									<Button className="w-full" variant="outline">
										<svg
											aria-label="Github"
											viewBox="0 0 24 24"
											xmlns="http://www.w3.org/2000/svg"
										>
											<title>Github Icon</title>
											<path
												d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
												fill="currentColor"
											/>
										</svg>
										Login with Github
									</Button>
								</div>
								<div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-accent after:border-t">
									<span className="relative z-10 bg-background px-2 text-muted-foreground">
										Or continue with
									</span>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										onChange={(e) => setEmail(e.target.value)}
										placeholder="name@example.com"
										required
										type="email"
										value={email}
									/>
								</div>
								<div className="grid gap-2">
									<div className="flex items-center">
										<Label htmlFor="password">Password</Label>
									</div>
									<Input
										id="password"
										onChange={(e) => setPassword(e.target.value)}
										required
										type="password"
										value={password}
									/>
								</div>
								<Button className="w-full" disabled={loading} type="submit">
									{loading ? "Loading..." : "Login"}
								</Button>
							</div>
							<div className="text-center text-sm">
								Don&apos;t have an account?{" "}
								<Link className="underline underline-offset-4" href="/sign-up">
									Sign up
								</Link>
							</div>
						</form>
					</div>
				</div>
			</div>
			<div className="relative hidden bg-background lg:block">
				{/* <LoginPageIllustration /> */}
			</div>
		</div>
	);
}
