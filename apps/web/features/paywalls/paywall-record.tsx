'use client';
import type { Paywall } from '@voidhash/db';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useConfirmDialog
} from '@voidhash/ui';
import { EllipsisVerticalIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import { deletePaywallAction } from '@/lib/nextjs/server-actions';

export function PaywallRecord({
  paywall,
  organizationSlug,
  projectSlug
}: {
  paywall: Paywall;
  organizationSlug: string;
  projectSlug: string;
}) {
  const router = useRouter();
  // const [setOpenEditModal] = useState(false);

  const { execute: deletePaywall, isPending } = useAction(deletePaywallAction, {
    onSuccess: () => {
      toast.success('Paywall was successfully deleted');
      router.refresh();
    },
    onError: (error) => {
      toast.error(
        error.error.serverError ??
          'Failed to delete the paywall. Please try again.'
      );
    }
  });

  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const handleDeletePaywall = async () => {
    const res = await openDialog({
      title: 'Delete paywall',
      description: 'Are you sure you want to delete this paywall?'
    });

    if (!res) {
      return;
    }

    deletePaywall({
      paywallId: paywall.id
    });
  };

  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <Link
        className="absolute inset-0 h-full w-full"
        href={`/${organizationSlug}/${projectSlug}/paywalls/${paywall.id}`}
      />
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div>{paywall.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="z-20" size="icon" variant="outline">
                <EllipsisVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* <DropdownMenuItem
								className="cursor-pointer"
								onSelect={(e) => {
									e.preventDefault();
									setOpenEditModal(true);
								}}
							>
								Edit paywall
							</DropdownMenuItem> */}
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={isPending}
                onClick={handleDeletePaywall}
              >
                {isPending ? 'Deleting...' : 'Delete paywall'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ConfirmationDialog />
      {/* <EditProductModal
				open={openEditModal}
				onClose={() => setOpenEditModal(false)}
				product={product}
			/> */}
    </div>
  );
}
