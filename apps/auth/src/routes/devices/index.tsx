// Inspired by https://github.com/unkeyed/examples/blob/main/unkey-cli/web/app/auth/devices/page.tsx
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Logo,
} from "@voidhash/ui";
import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "../../lib/auth-client";
import {
	DEVICE_CODE_EXPIRY_MS,
	isDeviceCodeExpired,
	isValidLocalRedirect,
} from "../../lib/validation";

const devicesSearchSchema = z.object({
	code: z.string().optional(),
	expires: z.string().optional(),
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/devices/")({
	component: AuthDevicesPage,
	validateSearch: zodValidator(devicesSearchSchema),
});

function CodeCharacter({ char }: { char: string }) {
	return (
		<div className="rounded-2xl bg-accent p-2 font-mono text-xl lg:p-4 lg:text-3xl">
			{char}
		</div>
	);
}

function AuthDevicePageLayout({ children }: { children: React.ReactNode }) {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const session = authClient.useSession();
	if (!session.data?.session && !session.isPending) {
		// Build the redirect URL with all search params
		const redirectParams = new URLSearchParams();
		if (search.code) {
			redirectParams.set("code", search.code);
		}
		if (search.redirect) {
			redirectParams.set("redirect", search.redirect);
		}
		if (search.expires) {
			redirectParams.set("expires", search.expires);
		}
		const nextUrl = `/auth/devices?${redirectParams.toString()}`;

		navigate({
			search: {
				next: nextUrl,
			},
			to: "/login",
		});
	}
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col items-center gap-6">
					<div className="flex justify-center">
						<Link to="/login">
							<Logo />
						</Link>
					</div>
					{children}
				</div>
			</div>
		</div>
	);
}

function Cancelled() {
	return (
		<AuthDevicePageLayout>
			<Card className="mt-4 min-w-lg text-center">
				<CardHeader>
					<CardTitle className="text-2xl">Login cancelled</CardTitle>
					<CardDescription>You can return to your CLI.</CardDescription>
				</CardHeader>
			</Card>
		</AuthDevicePageLayout>
	);
}

function Success() {
	return (
		<AuthDevicePageLayout>
			<Card className="mt-4 min-w-lg text-center">
				<CardHeader>
					<CardTitle className="text-2xl">Login successful!</CardTitle>
					<CardDescription>You can return to your CLI.</CardDescription>
				</CardHeader>
			</Card>
		</AuthDevicePageLayout>
	);
}

function ErrorCard({
	title = "An error occurred",
	description = "Please try again. If the problem persists, please contact us at support@voidhash.com.",
}: {
	title?: string;
	description?: string;
}) {
	return (
		<AuthDevicePageLayout>
			<Card className="mt-4 min-w-lg text-center">
				<CardHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<AlertCircle className="h-6 w-6 text-destructive" />
					</div>
					<CardTitle className="text-2xl">{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardFooter className="justify-center">
					<Link to="/login">
						<Button variant="outline">Return to Login</Button>
					</Link>
				</CardFooter>
			</Card>
		</AuthDevicePageLayout>
	);
}

function ExpiredCard() {
	return (
		<AuthDevicePageLayout>
			<Card className="mt-4 min-w-lg text-center">
				<CardHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
						<Clock className="h-6 w-6 text-muted-foreground" />
					</div>
					<CardTitle className="text-2xl">Code Expired</CardTitle>
					<CardDescription>
						This authorization request has expired. Please return to your CLI
						and try again.
					</CardDescription>
				</CardHeader>
				<CardFooter className="justify-center">
					<p className="text-muted-foreground text-xs">
						Device codes expire after{" "}
						{Math.floor(DEVICE_CODE_EXPIRY_MS / 60_000)} minutes for security.
					</p>
				</CardFooter>
			</Card>
		</AuthDevicePageLayout>
	);
}

export function AuthDevicesPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const [success, setSuccess] = useState(false);

	const searchParams = Route.useSearch();

	const { code, redirect: redirectUrl, expires } = searchParams;

	// Check for missing parameters
	if (!(code && redirectUrl)) {
		return (
			<ErrorCard
				description="The authorization request is missing required parameters. Please return to your CLI and try again."
				title="Invalid Request"
			/>
		);
	}

	// Validate redirect URL is localhost (prevent SSRF)
	if (!isValidLocalRedirect(redirectUrl)) {
		return (
			<ErrorCard
				description="The redirect URL must be a localhost address. This is required for security."
				title="Invalid Redirect"
			/>
		);
	}

	// Check if code has expired
	if (isDeviceCodeExpired(expires)) {
		return <ExpiredCard />;
	}

	const confirm = async () => {
		setIsLoading(true);
		const { data, error } = await authClient.apiKey.create({
			name: "CLI",
			prefix: "vh_cli_",
		});

		if (error) {
			toast.error("Error creating Voidhash API key.");
			setIsLoading(false);
			return;
		}

		try {
			const url = new URL(redirectUrl);
			url.searchParams.append("code", code);
			url.searchParams.append("key", data.key);
			await fetch(url.toString());
			setIsLoading(false);
			setSuccess(true);
		} catch {
			toast.error("Error redirecting back to local CLI. Is your CLI running?");
			setIsLoading(false);
		}
	};

	const cancel = async () => {
		try {
			setIsLoading(true);
			const url = new URL(redirectUrl);
			url.searchParams.append("cancelled", "true");
			await fetch(url.toString());
			setIsLoading(false);
			setCancelled(true);
		} catch {
			setIsLoading(false);
			toast.error("Error cancelling login. Is your local CLI running?");
		}
	};

	if (cancelled) {
		return <Cancelled />;
	}

	if (success) {
		return <Success />;
	}

	return (
		<AuthDevicePageLayout>
			<Card className="mt-4 min-w-lg text-center">
				<CardHeader>
					<CardTitle className="text-2xl">Device confirmation</CardTitle>
					<CardDescription>
						Please confirm this is the code shown in your terminal
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<div className="flex flex-row items-center justify-center">
						<div className="grid auto-cols-auto grid-flow-col gap-1 pt-6 leading-none lg:gap-3">
							{[...code].map((char, i) => (
								<CodeCharacter
									char={char}
									key={`${char}-${
										// biome-ignore lint/suspicious/noArrayIndexKey: OK in this case
										i
									}`}
								/>
							))}
						</div>
					</div>
					<div className="mt-6 flex flex-col gap-2">
						<Button
							className="w-full"
							disabled={isLoading}
							onClick={confirm}
							type="submit"
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Processing...
								</>
							) : (
								"Confirm code"
							)}
						</Button>
						<Button
							className="w-full"
							disabled={isLoading}
							onClick={cancel}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</div>
				</CardContent>
			</Card>
		</AuthDevicePageLayout>
	);
}
