import type { CustomerTypeValue } from '@voidhash/db';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { CustomerService } from '@/lib/services/customer.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
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
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const customerService = yield* CustomerService;
      const environmentService = yield* EnvironmentService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const environment =
            yield* environmentService.getEnvironmentFromCookie({
              projectId
            });
          return yield* Environment.provide(environment)(
            customerService.getCustomers({
              projectId,
              type
            })
          );
        })
      );
    }).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(customersResult)) {
    return (
      <VoidhashErrorCard
        error={encodeNextjsErrorResponse(customersResult.left)}
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
