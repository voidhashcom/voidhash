import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@voidhash/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@voidhash/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@voidhash/ui/form';
import { Input } from '@voidhash/ui/input';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

interface DeleteProjectModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  trigger: React.ReactNode;
  organizationSlug: string;
  projectSlug: string;
}

type DeleteProjectForm = {
  confirmation: string;
};

export function DeleteProjectModal({
  open,
  onClose,
  onDelete,
  trigger,
  organizationSlug,
  projectSlug
}: DeleteProjectModalProps) {
  const deleteProjectSchema = z.object({
    confirmation: z
      .string()
      .refine((value) => value === `${organizationSlug}/${projectSlug}`, {
        message:
          'Please enter the text exactly as it is shown to confirm deletion'
      })
  });

  const form = useForm<DeleteProjectForm>({
    resolver: zodResolver(deleteProjectSchema),
    defaultValues: {
      confirmation: ''
    }
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the
            project and all associated data.
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
                  <FormLabel className="inline select-text text-muted-foreground leading-relaxed">
                    Please type{' '}
                    <span className="font-mono text-foreground">
                      {organizationSlug}/{projectSlug}
                    </span>{' '}
                    to confirm.
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`${organizationSlug}/${projectSlug}`}
                      {...field}
                    />
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
                Delete Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
