import { ClusterWorkflowEngine } from '@effect/cluster';
import { BunClusterSocket } from '@effect/platform-bun';
import { MysqlClient } from '@effect/sql-mysql2';
import { BetterAuth } from '@voidhash/auth/effect';
import { Db } from '@voidhash/db/effect';
import {
  Duration,
  type Effect,
  Layer,
  ManagedRuntime,
  pipe,
  Redacted,
  Schedule
} from 'effect';
import { ApiKeyService } from './services/api-keys';
import { ChangesetDeploymentService } from './services/changeset-deployment';
import { CustomerService } from './services/customers';
import { OrganizationService } from './services/organizations';
import { PaymentProviderConfigurationService } from './services/payment-provider-configurations';
import { PerkService } from './services/perks';
import { ProductService } from './services/products';
import { ProjectService } from './services/projects';
import { SdkService } from './services/sdk';
import { UserService } from './services/users';
import { env } from './testing/env';

const DbLive = Db.Default;

const WorkflowEngineLayer = ClusterWorkflowEngine.layer.pipe(
  Layer.provideMerge(
    BunClusterSocket.layer().pipe(
      Layer.retry(
        Schedule.exponential(Duration.millis(100)).pipe(
          Schedule.intersect(Schedule.recurs(5))
        )
      )
    )
  ),
  Layer.provideMerge(
    MysqlClient.layer({
      host: env.DATABASE_HOST,
      database: env.DATABASE_NAME,
      username: env.DATABASE_USERNAME,
      password: Redacted.make(env.DATABASE_PASSWORD),
      poolConfig: {
        ssl: env.DATABASE_HOST?.includes('psdb.cloud')
          ? { rejectUnauthorized: true }
          : undefined
      }
    })
  )
);

const RuntimeLayer = () => {
  const CoreLayer = pipe(BetterAuth.Default, Layer.provideMerge(DbLive));

  const ServiceLayer = pipe(
    ApiKeyService.Default,
    Layer.provideMerge(ChangesetDeploymentService.Default),
    Layer.provideMerge(CustomerService.Default),
    Layer.provideMerge(OrganizationService.Default),
    Layer.provideMerge(PaymentProviderConfigurationService.Default),
    Layer.provideMerge(PerkService.Default),
    Layer.provideMerge(ProductService.Default),
    Layer.provideMerge(ProjectService.Default),
    Layer.provideMerge(SdkService.Default),
    Layer.provideMerge(UserService.Default)
  );

  return pipe(
    ServiceLayer,
    Layer.provideMerge(WorkflowEngineLayer),
    Layer.provideMerge(CoreLayer)
  );
};

export const createIntegrationTestRuntime = () =>
  ManagedRuntime.make(RuntimeLayer());

type AvailableServices = Layer.Layer.Success<ReturnType<typeof RuntimeLayer>>;

export const createIntegrationTestRunner =
  () =>
  async <T, C extends AvailableServices>(
    // biome-ignore lint/suspicious/noExplicitAny: is ok
    effect: Effect.Effect<T, any, C>
  ) => {
    const runtime = createIntegrationTestRuntime();
    try {
      return await runtime.runPromiseExit(pipe(effect));
    } finally {
      await runtime.dispose();
    }
  };
