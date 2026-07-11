"use client";
import { useParams } from "next/navigation";
import { Page } from "@/features/studio/shell";

import { ProjectsList } from "./projects-list";

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
          <ProjectsList organizationSlug={organizationSlug as string} />
        </div>
      </div>
    </Page>
  );
}
