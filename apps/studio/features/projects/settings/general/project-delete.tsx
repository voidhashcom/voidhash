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
import { DeleteProjectModal } from '@/features/projects/delete-project-modal';

export function ProjectDelete({ projectId }: { projectId: string }) {
  const { organizationSlug, projectSlug } = useParams();
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const router = useRouter();

  const deleteProject = useAtomSet(
    runtime.fn(
      Effect.fnUntraced(
        function* (payload: { projectId: string }) {
          const vrpc = yield* VRpc;
          setIsDeletingProject(true);
          const result = yield* vrpc('DeleteProject', {
            id: payload.projectId
          }).pipe(Effect.either);
          if (Either.isRight(result)) {
            router.push('/');
            setIsDeletingProject(false);
            return yield* Effect.succeed(undefined);
          }
          setIsDeletingProject(false);
          return yield* Effect.fail(result.left);
        },
        withToast({
          onSuccess: 'Project deleted successfully',
          onFailure: 'Failed to delete project',
          onWaiting: 'Deleting project...'
        })
      ),
      {
        reactivityKeys: queryKeys.invalidateAll()
      }
    )
  );
  const handleDelete = () => {
    deleteProject({
      projectId
    });
  };

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  if (typeof organizationSlug !== 'string' || typeof projectSlug !== 'string') {
    return null;
  }

  return (
    <Card className="mt-8 overflow-hidden pb-0" variant="destructive">
      <CardHeader>
        <CardTitle>Delete Project</CardTitle>
        <CardDescription>
          Permanently delete your project and all associated data. This action
          is irreversible.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
        <div className="text-muted-foreground" />
        <div>
          <DeleteProjectModal
            key={deleteModalOpen ? 'open' : 'closed'}
            onClose={() => setDeleteModalOpen(false)}
            onDelete={handleDelete}
            open={deleteModalOpen}
            organizationSlug={organizationSlug}
            projectSlug={projectSlug}
            trigger={
              <Button
                disabled={isDeletingProject}
                onClick={() => setDeleteModalOpen(true)}
                variant="destructive"
              >
                {isDeletingProject ? 'Deleting...' : 'Delete Project'}
              </Button>
            }
          />
        </div>
      </CardFooter>
    </Card>
  );
}
