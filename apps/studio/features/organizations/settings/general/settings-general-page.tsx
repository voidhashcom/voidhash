'use client';
import { Result } from '@effect-atom/atom-react';
import { SettingsCardSkeleton } from '@voidhash/ui';
import { useUser } from 'atom/user';
import { useParams } from 'next/navigation';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { SettingsGeneralLayout } from './settings-general-layout';
import { TeamDelete } from './team-delete';
import { TeamNameForm } from './team-name';

// export const _SettingsGeneralPage = Effect.fn('SettingsGeneralPage')(
//   function* ({ params }: { params: { organizationSlug: string } }) {
//     const { organizationSlug } = params;
//     const data = yield* Effect.either(
//       authenticateWithSession(yield* headers)(
//         Effect.gen(function* () {
//           const organizationService = yield* OrganizationService;
//           const activeOrganization =
//             yield* organizationService.getOrganizationBySlug(organizationSlug);

//           return { activeOrganization };
//         })
//       )
//     );

//     if (Either.isLeft(data)) {
//       return (
//         <VoidhashErrorCard
//           error={{
//             code: 'INTERNAL_SERVER_ERROR',
//             message: 'An error occured loading the organization'
//           }}
//         />
//       );
//     }

//     const { activeOrganization } = data.right;

//     return (

//     );
//   }
// );

export function SettingsGeneralPage() {
  const { organizationSlug } = useParams();
  return useUser().pipe(
    Result.match({
      onInitial: () => (
        <SettingsGeneralLayout>
          <SettingsCardSkeleton content={true} />
          <SettingsCardSkeleton
            action={false}
            content={false}
            description={false}
            instructions={false}
          />
        </SettingsGeneralLayout>
      ),
      onFailure: () => <div>Error</div>,
      onSuccess: ({ value: user }) => {
        const activeOrganization = user.organizations.find(
          (o) => o.slug === organizationSlug
        );
        if (!activeOrganization) {
          return (
            <VoidhashErrorCard
              error={{
                code: 'NOT_FOUND',
                message: 'Organization not found'
              }}
            />
          );
        }
        return (
          <SettingsGeneralLayout>
            <TeamNameForm
              key={organizationSlug as string}
              organization={activeOrganization}
            />
            <TeamDelete organizationId={activeOrganization.id} />
          </SettingsGeneralLayout>
        );
      }
    })
  );
}
