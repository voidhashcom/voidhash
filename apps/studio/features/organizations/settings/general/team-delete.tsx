'use client';

import { useAtomSet } from '@effect-atom/atom-react';
import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { VRpc } from 'atom/lib/rpc-client';
import { runtime } from 'atom/lib/runtime';
import { withToast } from 'atom/lib/with-toast';
import { queryKeys } from 'atom/query-keys';
import { Effect, Either } from 'effect';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { DeleteOrganizationModal } from '@/features/organizations/delete-organization-modal';

export function TeamDelete({ organizationId }: { organizationId: string }) {
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
  const { organizationSlug } = useParams();
  const router = useRouter();

  const deleteOrganization = useAtomSet(
    runtime.fn(
      Effect.fnUntraced(
        function* (payload: { organizationId: string }) {
          const vrpc = yield* VRpc;
          setIsDeletingOrganization(true);
          const result = yield* vrpc('DeleteOrganization', {
            organizationId: payload.organizationId
          }).pipe(Effect.either);
          if (Either.isRight(result)) {
            router.push('/');
            setIsDeletingOrganization(false);
            return yield* Effect.succeed(undefined);
          }
          setIsDeletingOrganization(false);
          return yield* Effect.fail(result.left);
        },
        withToast({
          onSuccess: 'Organization deleted successfully',
          onFailure: 'Failed to delete organization',
          onWaiting: 'Deleting organization...'
        })
      ),
      {
        reactivityKeys: queryKeys.invalidateAll()
      }
    )
  );

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
                disabled={isDeletingOrganization}
                onClick={() => setDeleteModalOpen(true)}
                variant="destructive"
              >
                {isDeletingOrganization ? 'Deleting...' : 'Delete Organization'}
              </Button>
            }
          />
        </div>
      </CardFooter>
    </Card>
  );
}
