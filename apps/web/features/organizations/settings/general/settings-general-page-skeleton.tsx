import { SettingsCardSkeleton } from '@voidhash/ui';
import { SettingsGeneralLayout } from './settings-general-layout';

export function SettingsGeneralPageSkeleton() {
  return (
    <SettingsGeneralLayout>
      <SettingsCardSkeleton content={true} />
      <SettingsCardSkeleton
        action={false}
        content={false}
        description={false}
        instructions={false}
      />
    </SettingsGeneralLayout>
  );
}
