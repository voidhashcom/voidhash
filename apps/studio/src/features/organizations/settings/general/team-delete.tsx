'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteOrganizationModal } from 'src/features/organizations/delete-organization-modal';
import { queryKeys } from 'src/lib/tanstack-query';
import { deleteOrganizationOptions } from 'src/lib/tanstack-query/organizations';

export function TeamDelete({ organizationId }: { organizationId: string }) {
  const { organizationSlug } = useParams({
    strict: false
  });
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const { mutate: deleteOrganization, status: deleteOrganizationStatus } =
    useMutation({
      ...deleteOrganizationOptions(),
      onSuccess: () => {
        toast.success('Organization deleted successfully');
        queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
        navigate({ to: '/' });
      },
      onError: () => {
        toast.error('Failed to delete organization');
      }
    });

  const handleDelete = () => {
    deleteOrganization({
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
                disabled={deleteOrganizationStatus === 'pending'}
                onClick={() => setDeleteModalOpen(true)}
                variant="destructive"
              >
                {deleteOrganizationStatus === 'pending'
                  ? 'Deleting...'
                  : 'Delete Organization'}
              </Button>
            }
          />
        </div>
      </CardFooter>
    </Card>
  );
}
