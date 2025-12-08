import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { authClient } from "@voidhash/auth/client";
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
import { CheckCircle, Shield, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

const consentSearchSchema = z.object({
	consent_code: z.string().optional(),
	client_id: z.string().optional(),
	scope: z.string().optional(),
});

export const Route = createFileRoute("/oidc/consent")({
	component: ConsentPage,
	validateSearch: zodValidator(consentSearchSchema),
});

function ConsentPageContent() {
	const searchParams = Route.useSearch();
	const [loading, setLoading] = useState(false);

	const consentCode = searchParams.consent_code;
	const clientId = searchParams.client_id;
	const scope = searchParams.scope;

	const scopes = scope?.split(" ") ?? [];

	const getScopeDescription = (scopeName: string) => {
		const descriptions: Record<string, string> = {
			openid: "Verify your identity",
			profile: "Access your profile information (name, picture)",
			email: "Access your email address",
		};
		return descriptions[scopeName] ?? scopeName;
	};

	const handleConsent = async (accept: boolean) => {
		if (!consentCode) {
			return;
		}

		setLoading(true);

		try {
			const response = await authClient.oauth2.consent({
				accept,
				consent_code: consentCode,
			});

			if (response.data?.redirectURI) {
				window.location.href = response.data.redirectURI;
			}
		} catch {
			setLoading(false);
		}
	};

	if (!(consentCode && clientId)) {
		return (
			<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle className="text-destructive text-xl">
							Invalid Request
						</CardTitle>
						<CardDescription>
							The authorization request is missing required parameters.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Link href="/login">
							<Button variant="outline">Return to Login</Button>
						</Link>
					</CardFooter>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-md">
				<div className="flex flex-col gap-6">
					<div className="flex justify-center">
						<Link href="/">
							<Logo />
						</Link>
					</div>

					<Card className="mt-4">
						<CardHeader className="text-center">
							<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
								<Shield className="h-6 w-6 text-primary" />
							</div>
							<CardTitle className="text-xl">Authorize Application</CardTitle>
							<CardDescription>
								<span className="font-medium text-foreground">{clientId}</span>{" "}
								wants to access your account
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-4">
							<div className="rounded-lg border bg-muted/50 p-4">
								<p className="mb-3 font-medium text-sm">
									This application will be able to:
								</p>
								<ul className="space-y-2">
									{scopes.map((scopeName) => (
										<li
											className="flex items-center gap-2 text-muted-foreground text-sm"
											key={scopeName}
										>
											<CheckCircle className="h-4 w-4 text-green-500" />
											{getScopeDescription(scopeName)}
										</li>
									))}
								</ul>
							</div>
						</CardContent>

						<CardFooter className="flex gap-3">
							<Button
								className="flex-1"
								disabled={loading}
								onClick={() => handleConsent(false)}
								variant="outline"
							>
								<XCircle className="mr-2 h-4 w-4" />
								Deny
							</Button>
							<Button
								className="flex-1"
								disabled={loading}
								onClick={() => handleConsent(true)}
							>
								<CheckCircle className="mr-2 h-4 w-4" />
								{loading ? "Authorizing..." : "Allow"}
							</Button>
						</CardFooter>
					</Card>

					<p className="text-center text-muted-foreground text-xs">
						By authorizing, you allow this application to access your data as
						described above.
					</p>
				</div>
			</div>
		</div>
	);
}

export function ConsentPage() {
	return <ConsentPageContent />;
}
