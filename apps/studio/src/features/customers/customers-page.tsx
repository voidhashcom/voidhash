'use client';

import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger
} from '@voidhash/ui';
import { useParams } from 'next/navigation';
import { useAuth } from 'src/components/auth-context';
import { VoidhashErrorCard } from 'src/features/shell/components/voidhash-error-card';
import { CurrentUser } from 'src/lib/utils/current-user';
import { Page } from '../shell';
import { CreateCustomerButton } from './create-customer-button';
import { CustomersTable } from './customers-table';

export const CustomersPage = () => {
  const { organizationSlug, projectSlug } = useParams();
  const { user } = useAuth();

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          title: 'Project not found',
          message: 'The project you are looking for does not exist.'
        }}
      />
    );
  }

  return (
    <Page className="p-0 py-8">
      <div className="mx-auto flex max-w-4xl flex-row items-center justify-between">
        <h1 className="font-normal text-3xl tracking-right">Customers</h1>
        <CreateCustomerButton projectId={project.id} />
      </div>

      <div className="mt-3">
        <UnderlineTabs defaultValue="identified">
          <UnderlineTabsList>
            <div className="mx-auto inline-flex w-full max-w-4xl items-center space-x-4 rounded-none">
              <UnderlineTabsTrigger value="identified">
                Identified
              </UnderlineTabsTrigger>
              <UnderlineTabsTrigger value="anonymous">
                <span>Anonymous</span>
              </UnderlineTabsTrigger>
            </div>
          </UnderlineTabsList>
          <UnderlineTabsContent value="identified">
            <div className="mx-auto max-w-4xl">
              <CustomersTable
                organizationSlug={organizationSlug as string}
                projectId={project.id}
                projectSlug={projectSlug as string}
                type={1} // TODO: Use CustomerType
              />
            </div>
          </UnderlineTabsContent>
          <UnderlineTabsContent value="anonymous">
            <div className="mx-auto max-w-4xl">
              <CustomersTable
                organizationSlug={organizationSlug as string}
                projectId={project.id}
                projectSlug={projectSlug as string}
                type={2} // TODO: Use CustomerType
              />
            </div>
          </UnderlineTabsContent>
        </UnderlineTabs>
      </div>
    </Page>
  );
};
