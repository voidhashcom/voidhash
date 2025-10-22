'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteProjectModal } from '@/features/projects/delete-project-modal';
import { queryKeys } from '@/lib/tanstack-query';
import { deleteProjectOptions } from '@/lib/tanstack-query/projects';

export function ProjectDelete({ projectId }: { projectId: string }) {
  const { organizationSlug, projectSlug } = useParams();
  const router = useRouter();

  const queryClient = useQueryClient();
  const { mutate: deleteProject, status: deleteProjectStatus } = useMutation({
    ...deleteProjectOptions(),
    onSuccess: () => {
      toast.success('Project deleted successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
      router.push('/');
    },
    onError: () => {
      toast.error('Failed to delete project');
    }
  });

  const handleDelete = () => {
    deleteProject({
      id: projectId
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
                disabled={deleteProjectStatus === 'pending'}
                onClick={() => setDeleteModalOpen(true)}
                variant="destructive"
              >
                {deleteProjectStatus === 'pending'
                  ? 'Deleting...'
                  : 'Delete Project'}
              </Button>
            }
          />
        </div>
      </CardFooter>
    </Card>
  );
}
