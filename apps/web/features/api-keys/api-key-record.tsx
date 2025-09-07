'use client';
import type { ApiKey } from '@voidhash/db';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirmDialog
} from '@voidhash/ui';
import { EllipsisVerticalIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  deleteSecretKeyAction,
  rotateSecretKeyAction
} from '@/lib/nextjs/server-actions';
import { SecretKeyRevealModal } from './secret-key-reveal-modal';

export function ApiKeyRecord({ apiKey }: { apiKey: ApiKey }) {
  const router = useRouter();
  const [secretKey, setSecretKey] = useState<ApiKey | null>(null);
  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Rotate key
  const { execute: rotateKey, isExecuting: isRotating } = useAction(
    rotateSecretKeyAction,
    {
      onSuccess: (res) => {
        toast.success('Key successfully rotated');
        router.refresh();
        if (res.data) {
          setSecretKey(res.data);
        }
      },
      onError: () => {
        toast.error('Failed to rotate key');
      }
    }
  );
  const handleRotateKey = async () => {
    const res = await openDialog({
      title: 'Rotate key',
      description:
        'Are you sure you want to rotate this key? It may break any services that are using it.',
      confirmText: 'Rotate'
    });
    if (res) {
      rotateKey({
        secretKeyId: apiKey.id
      });
    }
  };

  // Delete key
  const { execute: deleteKey, isExecuting: isDeleting } = useAction(
    deleteSecretKeyAction,
    {
      onSuccess: () => {
        toast.success('Key successfully deleted');
        router.refresh();
      },
      onError: () => {
        toast.error('Failed to delete key');
      }
    }
  );
  const handleDeleteKey = async () => {
    const res = await openDialog({
      title: 'Delete key',
      description:
        'Are you sure you want to delete this key? It may break any services that are using it. This action cannot be undone.',
      confirmText: 'Delete'
    });
    if (res) {
      deleteKey({
        secretKeyId: apiKey.id
      });
    }
  };
  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="w-42">{apiKey.name}</div>

          {apiKey?.isPublic ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="cursor-pointer text-left"
                    onClick={() => copyToClipboard(apiKey.key)}
                    type="button"
                  >
                    <p className="w-64 whitespace-pre-wrap break-words text-muted-foreground">
                      {apiKey.key}
                    </p>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to copy</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <p className="w-64 whitespace-pre-wrap text-muted-foreground">
              {apiKey.prefix}...{apiKey.end}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Only secret keys are deletable */}
          {!apiKey.isPublic && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="z-20" size="icon" variant="outline">
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isRotating}
                  onClick={handleRotateKey}
                >
                  Rotate key
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isDeleting}
                  onClick={handleDeleteKey}
                >
                  Delete key
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <ConfirmationDialog />
      <SecretKeyRevealModal
        apiKey={secretKey}
        onClose={() => setSecretKey(null)}
        open={!!secretKey}
      />
    </div>
  );
}
