import { CustomerType } from '@voidhash/db';
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger
} from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { ProjectService } from '@/lib/services/project.service';
import { VoidhashErrorCard } from '../shell/components/voidhash-error-card';
import { CreateCustomerButton } from './create-customer-button';
import { CustomersTable } from './customers-table';

const _CustomersPage = Effect.fn('CustomersPage')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug;
}) {
  const data = yield* Effect.either(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          const project =
            yield* projectService.getProjectBySlugAndOrganizationSlug({
              organizationSlug,
              projectSlug
            });
          if (!project) {
            return yield* Effect.fail(
              new NotFoundError({
                message: 'Project not found'
              })
            );
          }
          return { project };
        })
      );
    }).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(data)) {
    const error = data.left;
    return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
  }

  const { project } = data.right;

  return (
    <Page className="p-0 py-8">
      {/* Key is used to reload the default form data when the organization slug changes */}

      <div className="mx-auto flex max-w-4xl flex-row items-center justify-between">
        <h1 className="font-normal text-3xl tracking-right">Customers</h1>
        <CreateCustomerButton projectId={project.id} />
      </div>
      {/* <p className="text-muted-foreground mt-3">
					List of products available to purchase.
				</p> */}

      <div className="mt-3">
        <UnderlineTabs defaultValue="identified">
          <UnderlineTabsList>
            <div className="mx-auto inline-flex w-full max-w-4xl items-center space-x-4 rounded-none">
              <UnderlineTabsTrigger value="identified">
                Identified
              </UnderlineTabsTrigger>
              <UnderlineTabsTrigger value="anonymous">
                <span>Anonymous</span> {/* Number of unidentified customers */}
                {/* {!!10 && (
									<Badge
										variant="secondary"
										className="ml-2 px-1 py-0 text-xs rounded-full"
									>
										10
									</Badge>
								)} */}
              </UnderlineTabsTrigger>
            </div>
          </UnderlineTabsList>
          <UnderlineTabsContent value="identified">
            <div className="mx-auto max-w-4xl">
              <CustomersTable
                organizationSlug={organizationSlug}
                projectId={project.id}
                projectSlug={projectSlug}
                type={CustomerType.Identified}
              />
            </div>
          </UnderlineTabsContent>
          <UnderlineTabsContent value="anonymous">
            <div className="mx-auto max-w-4xl">
              <CustomersTable
                organizationSlug={organizationSlug}
                projectId={project.id}
                projectSlug={projectSlug}
                type={CustomerType.Anonymous}
              />
            </div>
          </UnderlineTabsContent>
        </UnderlineTabs>
      </div>
    </Page>
  );
});

export const CustomersPage = ServerComponent.build(_CustomersPage);
