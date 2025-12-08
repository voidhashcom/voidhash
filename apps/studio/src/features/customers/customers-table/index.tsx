'use client';

import { useQuery } from '@tanstack/react-query';
import { VoidhashErrorCard } from 'src/features/shell/components/voidhash-error-card';
import { listCustomersOptions } from 'src/lib/tanstack-query/customers';
import { columns } from './columns';
import { DataTable } from './data-table';

export const CustomersTable = ({
  type,
  projectId,
  organizationSlug,
  projectSlug
}: {
  type?: 1 | 2; // TODO: Use CustomerType
  organizationSlug: string;
  projectSlug: string;
  projectId: string;
}) => {
  const { data, status } = useQuery(listCustomersOptions({ projectId }));

  if (status === 'pending') {
    return <div>Loading customers...</div>;
  }

  if (status === 'error') {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the customers'
        }}
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data?.filter((customer) => customer.type === type) ?? []}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
};
