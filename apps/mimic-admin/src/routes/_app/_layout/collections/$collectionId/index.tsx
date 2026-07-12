import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
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
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { documentsQuery } from "@/lib/queries";

export const Route = createFileRoute(
	"/_app/_layout/collections/$collectionId/",
)({
	component: CollectionDocumentsPage,
});

function CollectionDocumentsPage() {
	const { collectionId } = Route.useParams();
	const sdk = useMimicSdk();
	const queryClient = useQueryClient();

	const { data: documents, isLoading } = useQuery(
		documentsQuery(sdk, collectionId),
	);

	const [dataJson, setDataJson] = useState(
		JSON.stringify(
			{
				kind: "object",
				fields: {},
			},
			null,
			2,
		),
	);
	const [open, setOpen] = useState(false);

	const createMutation = useMutation({
		mutationFn: () => {
			const data = JSON.parse(dataJson);
			return sdk
				.database("")
				.collectionRaw(collectionId)
				.createDocumentRaw(data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["documents", collectionId],
			});
			setDataJson(
				JSON.stringify(
					{
						kind: "object",
						fields: {},
					},
					null,
					2,
				),
			);
			setOpen(false);
			toast.success("Document created");
		},
		onError: (err) =>
			toast.error(`Failed to create document: ${err.message}`),
	});

	const deleteMutation = useMutation({
		mutationFn: (documentId: string) =>
			sdk.database("").collectionRaw(collectionId).deleteDocument(documentId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["documents", collectionId],
			});
			toast.success("Document deleted");
		},
		onError: (err) =>
			toast.error(`Failed to delete document: ${err.message}`),
	});

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Documents</h2>
					<p className="text-sm text-muted-foreground">
						Collection: {collectionId}
					</p>
				</div>
				<div className="flex gap-2">
					<Link
						to="/collections/$collectionId/schema"
						params={{ collectionId }}
					>
						<Button variant="outline">Schema</Button>
					</Link>
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Create Document
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create Document</DialogTitle>
							</DialogHeader>
							<form
								onSubmit={(e) => {
									e.preventDefault();
									try {
										JSON.parse(dataJson);
										createMutation.mutate();
									} catch {
										toast.error("Invalid JSON");
									}
								}}
								className="grid gap-4"
							>
								<div className="grid gap-2">
									<Label>Value (JSON)</Label>
									<Textarea
										value={dataJson}
										onChange={(e) => setDataJson(e.target.value)}
										className="min-h-[200px] font-mono text-sm"
									/>
								</div>
								<DialogFooter>
									<DialogClose asChild>
										<Button variant="outline">Cancel</Button>
									</DialogClose>
									<Button
										type="submit"
										disabled={createMutation.isPending}
									>
										{createMutation.isPending ? "Creating..." : "Create"}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<Tabs defaultValue="list">
				<TabsList>
					<TabsTrigger value="list">List</TabsTrigger>
				</TabsList>
				<TabsContent value="list">
					{isLoading ? (
						<p className="text-muted-foreground">Loading...</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>ID</TableHead>
									<TableHead>Version</TableHead>
									<TableHead>Value Preview</TableHead>
									<TableHead className="w-16" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{documents?.map((doc) => (
									<TableRow key={doc.id}>
										<TableCell>
											<Link
												to="/collections/$collectionId/documents/$documentId"
												params={{
													collectionId,
													documentId: doc.id,
												}}
												className="font-mono text-sm text-primary hover:underline"
											>
												{doc.id}
											</Link>
										</TableCell>
										<TableCell>{doc.version}</TableCell>
										<TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
											{JSON.stringify(doc.flat).slice(0, 100)}
										</TableCell>
										<TableCell>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button variant="ghost" size="icon">
														<Trash2 className="h-4 w-4 text-destructive-foreground" />
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															Delete document?
														</AlertDialogTitle>
														<AlertDialogDescription>
															This will permanently delete document "{doc.id}".
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() =>
																deleteMutation.mutate(doc.id)
															}
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</TableCell>
									</TableRow>
								))}
								{documents?.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={4}
											className="text-center text-muted-foreground"
										>
											No documents yet.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
