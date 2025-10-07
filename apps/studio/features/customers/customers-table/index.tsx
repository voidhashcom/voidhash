import {
  authenticateWithSession,
  CustomerService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import type { CustomerTypeValue } from '@voidhash/db';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { columns } from './columns';
import { DataTable } from './data-table';

const _CustomersTable = Effect.fn('CustomersTable')(function* ({
  projectId,
  type,
  organizationSlug,
  projectSlug
}: {
  projectId: string;
  type?: CustomerTypeValue;
  organizationSlug: string;
  projectSlug: string;
}) {
  const customersResult = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      withEnvironmentFromCookie({ projectId })(
        Effect.gen(function* () {
          const customerService = yield* CustomerService;
          return yield* customerService.getCustomers({
            projectId,
            type
          });
        })
      )
    )
  );

  if (Either.isLeft(customersResult)) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the customers'
        }}
      />
    );
  }

  const customers = customersResult.right;

  return (
    <DataTable
      columns={columns}
      data={customers}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
});

export const CustomersTable = ServerComponent.build(_CustomersTable);
