import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@voidhash/ui/form";
import { Input } from "@voidhash/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";

interface DeleteOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  trigger: React.ReactNode;
  organizationSlug: string;
}

interface DeleteOrganizationForm {
  confirmation: string;
}

export function DeleteOrganizationModal({
  open,
  onClose,
  onDelete,
  trigger,
  organizationSlug,
}: DeleteOrganizationModalProps) {
  const deleteOrganizationSchema = z.object({
    confirmation: z
      .string()
      .refine((value) => value === `${organizationSlug}`, {
        message:
          "Please enter the text exactly as it is shown to confirm deletion",
      }),
  });

  const form = useForm<DeleteOrganizationForm>({
    defaultValues: {
      confirmation: "",
    },
    resolver: zodResolver(deleteOrganizationSchema),
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
    }
  };

  const onSubmit = () => {
    onClose();
    onDelete();
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {/* @ts-expect-error React types version conflict between @types/react and @radix-ui */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Team</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the
            organization and all associated data.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="mt-2 space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Please type{" "}
                    <span className="select-text font-mono">
                      {organizationSlug}
                    </span>{" "}
                    to confirm
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={`${organizationSlug}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="justify-between">
              <Button className="mt-3" onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button className="mt-3" type="submit" variant="destructive">
                Delete Team
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
