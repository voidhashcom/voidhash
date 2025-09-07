'use client';

import {
  Environment as EnvironmentEnum,
  type EnvironmentValue
} from '@voidhash/lib/index';
import { cn, Label, Switch } from '@voidhash/ui';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import { switchEnvironmentAction } from '@/lib/nextjs/server-actions';

export function NavProjectEnvironmentToggle({
  environment,
  projectId
}: {
  environment: EnvironmentValue;
  projectId: string;
}) {
  const router = useRouter();
  const { execute, isExecuting } = useAction(switchEnvironmentAction, {
    onSuccess: ({ input }) => {
      if (input.environment === EnvironmentEnum.Testing) {
        toast.success('Switched to testing environment');
      } else {
        toast.success('Switched to production environment');
      }
    },
    onError: () => {
      toast.error('Failed to switch environment');
    },
    onSettled: () => {
      router.refresh();
    }
  });

  const handleSwitch = () => {
    execute({
      projectId,
      environment:
        environment === EnvironmentEnum.Testing
          ? EnvironmentEnum.Production
          : EnvironmentEnum.Testing
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Label
        className={cn(
          environment === EnvironmentEnum.Testing && 'text-primary'
        )}
        htmlFor="test-mode-switch"
      >
        Dev Mode
      </Label>
      <Switch
        checked={environment === EnvironmentEnum.Testing}
        className="data-[state=checked]:bg-primary"
        disabled={isExecuting}
        id="test-mode-switch"
        onCheckedChange={handleSwitch}
      />
    </div>
  );
}
