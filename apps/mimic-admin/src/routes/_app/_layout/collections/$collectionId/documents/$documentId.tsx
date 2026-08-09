import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, Trash2 } from "lucide-react";
import { Option, Schema, SchemaGetter, SchemaTransformation } from "effect";
import { pick } from "@voidhash/lib/lang";
import { toast } from "sonner";

import { useMimicSdk } from "@/components/sdk-context";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { documentQuery } from "@/lib/queries";

export const Route = createFileRoute(
	"/_app/_layout/collections/$collectionId/documents/$documentId",
)({
	component: DocumentPage,
});

/** Codec between an arbitrary JSON value and its indented text form. */
const PrettyJsonText = Schema.String.pipe(
	Schema.decodeTo(
		Schema.Unknown,
		new SchemaTransformation.Transformation<unknown, string>(
			SchemaGetter.parseJson(),
			SchemaGetter.stringifyJson({ space: 2 }),
		),
	),
);

const formatJson = Schema.encodeSync(PrettyJsonText);
const decodeJson = Schema.decodeSync(PrettyJsonText);
const decodeJsonOption = Schema.decodeOption(PrettyJsonText);
const decodePermission = Schema.decodeUnknownSync(Schema.Literals(["read", "write"]));

/** Label for the replace-value button. */
function replaceLabel(isPending: boolean): string {
	if (isPending) return "Replacing...";
	return "Replace Value";
}

/** Label for the generate-connection button. */
function generateLabel(isPending: boolean): string {
	if (isPending) return "Generating...";
	return "Generate Connection";
}

function DocumentPage() {
	const { collectionId, documentId } = Route.useParams();
	const sdk = useMimicSdk();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: document, isLoading } = useQuery(
		documentQuery(sdk, collectionId, documentId),
	);

	const [editJson, setEditJson] = useState("");
	const [tokenPermission, setTokenPermission] = useState<"read" | "write">(
		"read",
	);
	const [tokenExpiry, setTokenExpiry] = useState("");
	const [tokenOrigins, setTokenOrigins] = useState("https://mimic-admin.voidhash.localhost");
	const [generatedAuth, setGeneratedAuth] = useState<{
		token: string;
		url: string;
	} | null>(null);

	const setMutation = useMutation({
		mutationFn: () => {
			const data = decodeJson(editJson);
			return sdk
				.database("")
				.collectionRaw(collectionId)
				.setDocumentRaw(documentId, data);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["document", collectionId, documentId],
			});
			toast.success("Document replaced");
		},
		onError: (err) => toast.error(`Set failed: ${err.message}`),
	});

	const deleteMutation = useMutation({
		mutationFn: () =>
			sdk.database("").collectionRaw(collectionId).deleteDocument(documentId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["documents", collectionId],
			});
			toast.success("Document deleted");
			void navigate({
				to: "/collections/$collectionId",
				params: { collectionId },
			});
		},
		onError: (err) => toast.error(`Delete failed: ${err.message}`),
	});

	const tokenMutation = useMutation({
		mutationFn: () =>
			sdk.setupDocumentAuthentication({
				collectionId,
				documentId,
				permission: tokenPermission,
				origins: tokenOrigins
					.split(/[\n,]/)
					.map((origin) => origin.trim())
					.filter(Boolean),
				expiresInSeconds: pick(tokenExpiry.length > 0, Number(tokenExpiry), undefined),
			}),
		onSuccess: (result) => {
			setGeneratedAuth(result);
			toast.success("Authentication setup created");
		},
		onError: (err) => toast.error(`Authentication setup failed: ${err.message}`),
	});

	useEffect(() => {
		if (!document) {
			return;
		}
		setEditJson(formatJson(document.flat));
	}, [document]);

	if (isLoading) {
		return <p className="text-muted-foreground">Loading...</p>;
	}

	if (!document) {
		return <p className="text-muted-foreground">Document not found.</p>;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Document</h2>
					<p className="text-sm text-muted-foreground">
						{documentId} (v{document.version})
					</p>
				</div>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="destructive">
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete document?</AlertDialogTitle>
							<AlertDialogDescription>
								This will permanently delete this document.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={() => deleteMutation.mutate()}>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Current Value</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="overflow-auto rounded-md bg-muted p-4 text-sm">
						{formatJson(document.flat)}
					</pre>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Replace Document Value</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<Textarea
							value={editJson}
							onChange={(e) => setEditJson(e.target.value)}
							className="min-h-[200px] font-mono text-sm"
						/>
						<Button
							onClick={() => {
								Option.match(decodeJsonOption(editJson), {
									onSome: () => setMutation.mutate(),
									onNone: () => toast.error("Invalid JSON"),
								});
							}}
							disabled={setMutation.isPending}
							variant="outline"
						>
							{replaceLabel(setMutation.isPending)}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Document Authentication</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-end gap-4">
						<div className="grid gap-1">
							<Label className="text-xs">Permission</Label>
							<Select
								value={tokenPermission}
								onValueChange={(v) => setTokenPermission(decodePermission(v))}
							>
								<SelectTrigger className="w-28">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="read">read</SelectItem>
									<SelectItem value="write">write</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-1">
							<Label className="text-xs">Expires in (seconds)</Label>
							<Input
								type="number"
								value={tokenExpiry}
								onChange={(e) => setTokenExpiry(e.target.value)}
								placeholder="Optional"
								className="w-36"
							/>
						</div>
						<div className="grid min-w-[320px] flex-1 gap-1">
							<Label className="text-xs">Allowed origins</Label>
							<Textarea
								value={tokenOrigins}
								onChange={(e) => setTokenOrigins(e.target.value)}
								placeholder="One origin per line or comma-separated"
								className="min-h-24 text-sm"
							/>
						</div>
						<Button
							onClick={() => tokenMutation.mutate()}
							disabled={tokenMutation.isPending}
						>
							{generateLabel(tokenMutation.isPending)}
						</Button>
					</div>
					{generatedAuth && (
						<div className="space-y-2 rounded-md bg-muted p-3">
							<div className="flex items-center gap-2">
								<code className="flex-1 break-all text-xs">
									{generatedAuth.url}
								</code>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => {
										void navigator.clipboard.writeText(generatedAuth.url);
										toast.success("Connection URL copied to clipboard");
									}}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
							<div className="flex items-center gap-2">
								<code className="flex-1 break-all text-xs">
									{generatedAuth.token}
								</code>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => {
										void navigator.clipboard.writeText(generatedAuth.token);
										toast.success("Token copied to clipboard");
									}}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
