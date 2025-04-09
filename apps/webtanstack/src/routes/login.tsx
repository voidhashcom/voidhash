import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { z } from "zod";
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
import { useState } from "react";
import { toast } from "sonner";

const loginSearchSchema = z.object({
	signup: z.boolean().catch(false),
	email: z.string().optional(),
});

export const Route = createFileRoute("/login")({
	component: RouteComponent,
	validateSearch: (search) => loginSearchSchema.parse(search),
});

function RouteComponent() {
	const search = Route.useSearch();
	const context = Route.useRouteContext();

	const navigate = useNavigate({ from: "/login" });
	const router = useRouter();

	const [email, setEmail] = useState(search.email || "");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const signIn = async () => {
		await authClient.signIn.email(
			{
				email: email,
				password: password,
			},
			{
				onRequest: () => {
					setLoading(true);
				},
				onSuccess: () => {
					context.queryClient.invalidateQueries({
						queryKey: authQueryKeys.all,
					});
					navigate({
						to: "/",
						replace: true,
					});
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
					setLoading(false);
				},
			}
		);
	};

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 bg-surface-3 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link to="/" className="flex items-center gap-2 font-medium">
						<Logo />
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<form className="flex flex-col gap-6" onSubmit={signIn}>
							{search.signup && (
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
								<Button
									type="submit"
									className="w-full"
									disabled={loading}
									onClick={signIn}
								>
									{loading ? "Loading..." : "Login"}
								</Button>
							</div>
							<div className="text-center text-sm">
								Don&apos;t have an account?{" "}
								<Link to="/sign-up" className="underline underline-offset-4">
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
