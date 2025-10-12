'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { useParams, useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteOrganizationModal } from '@/features/organizations/delete-organization-modal';
import { useTRPC } from '@/features/trpc/react';

export function TeamDelete({ organizationId }: { organizationId: string }) {
  const { organizationSlug } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { execute, isPending } = useAction(deleteOrganizationAction, {
    onSuccess: () => {
      toast.success('Team deleted successfully');
      queryClient.invalidateQueries({
        queryKey: trpc.pathKey()
      });
      router.push('/');
    },
    onError: (error) => {
      toast.error(error.error.serverError);
    }
  });

  const handleDelete = () => {
    execute({
      organizationId
    });
  };

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  if (typeof organizationSlug !== 'string') {
    return null;
  }

  return (
    <Card className="mt-8 overflow-hidden pb-0" variant="destructive">
      <CardHeader>
        <CardTitle>Delete Team</CardTitle>
        <CardDescription>
          Permanently delete your team and all associated data. This action is
          irreversible.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
        <div className="text-muted-foreground" />
        <div>
          <DeleteOrganizationModal
            key={deleteModalOpen ? 'open' : 'closed'}
            onClose={() => setDeleteModalOpen(false)}
            onDelete={handleDelete}
            open={deleteModalOpen}
            organizationSlug={organizationSlug}
            trigger={
              <Button
                disabled={isPending}
                onClick={() => setDeleteModalOpen(true)}
                variant="destructive"
              >
                {isPending ? 'Deleting...' : 'Delete Team'}
              </Button>
            }
          />
        </div>
      </CardFooter>
    </Card>
  );
}
