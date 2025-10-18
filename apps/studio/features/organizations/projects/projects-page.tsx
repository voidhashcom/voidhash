'use client';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { Page } from '@/features/shell';
import { ProjectsList } from './projects-list';
import { ProjectsSkeleton } from './projects-skeleton';

export function ProjectsPage() {
  const { organizationSlug } = useParams();
  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Projects</h1>
        <p className="mt-3 text-muted-foreground">
          All projects of organization {organizationSlug}
        </p>
        <div className="mt-8">
          <Suspense fallback={<ProjectsSkeleton />}>
            <ProjectsList />
          </Suspense>
        </div>
      </div>
    </Page>
  );
}
