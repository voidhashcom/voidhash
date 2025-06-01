"use client";

import { Button } from "@voidhash/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@voidhash/ui/dialog";
import { Input } from "@voidhash/ui/input";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@voidhash/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { createSecretKeyAction } from "@/lib/nextjs/server-actions";
import { ApiKey } from "@/lib/services/api-keys/types";

const createSecretKeySchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

type CreateSecretKeyForm = z.infer<typeof createSecretKeySchema>;

interface CreateSecretKeyModalProps {
	open: boolean;
	onClose: () => void;
	trigger: React.ReactNode;
	projectId: string;
	onSuccess?: (apiKey: ApiKey) => void;
}

export function CreateSecretKeyModal({
	open,
	onClose,
	trigger,
	projectId,
	onSuccess,
}: CreateSecretKeyModalProps) {
	const form = useForm<CreateSecretKeyForm>({
		resolver: zodResolver(createSecretKeySchema),
		defaultValues: {
			name: "",
		},
	});

	const { execute, isPending } = useAction(createSecretKeyAction, {
		onSuccess: (res) => {
			if (res.data) {
				toast.success("Secret key created successfully");
				onSuccess?.(res.data);
				handleOpenChange(false);
			}
		},
		onError: (error) => {
			toast.error(error.error.serverError || "Failed to create secret key");
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
			form.reset();
		}
	};

	const onSubmit = (data: CreateSecretKeyForm) => {
		execute({ ...data, projectId });
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create New Secret Key</DialogTitle>
					<DialogDescription>
						Create a new secret key to authenticate your API requests.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 pt-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem className="space-y-1">
									<FormLabel>Key Name</FormLabel>
									<FormControl>
										<Input placeholder="Production API Key" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<DialogFooter>
							<Button
								type="submit"
								disabled={isPending}
								className="w-full mt-4"
							>
								{isPending ? "Creating Key..." : "Create Key"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
