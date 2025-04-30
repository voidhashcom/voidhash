"use client";

import { Button } from "@voidhash/ui/button";
import {
	Dialog,
	DialogContent,
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
import { createPerkAction } from "@/lib/nextjs/server-actions";
import { useRouter } from "next/navigation";
import { InferSafeActionFnResult } from "next-safe-action";

const createPerkSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

type CreatePerkForm = z.infer<typeof createPerkSchema>;
type Perk = InferSafeActionFnResult<typeof createPerkAction>["data"];

interface CreatePerkModalProps {
	open: boolean;
	onClose: () => void;
	trigger: React.ReactNode;
	projectId: string;
	onSuccess?: (perk: Perk) => void;
}

export function CreatePerkModal({
	open,
	onClose,
	trigger,
	projectId,
	onSuccess,
}: CreatePerkModalProps) {
	const router = useRouter();
	const form = useForm<CreatePerkForm>({
		resolver: zodResolver(createPerkSchema),
		defaultValues: {
			name: "",
		},
	});

	const { execute, isPending } = useAction(createPerkAction, {
		onSuccess: (res) => {
			if (res.data) {
				toast.success("Perk created successfully");
				onSuccess?.(res.data);
				router.refresh();
				handleOpenChange(false);
			}
		},
		onError: (error) => {
			toast.error(error.error.serverError || "Failed to create perk");
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
			form.reset();
		}
	};

	const onSubmit = (data: CreatePerkForm) => {
		execute({ ...data, projectId });
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create Perk</DialogTitle>
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
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input
											placeholder="All-Access, AI-features, etc."
											{...field}
										/>
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
								{isPending ? "Creating Perk..." : "Create Perk"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
