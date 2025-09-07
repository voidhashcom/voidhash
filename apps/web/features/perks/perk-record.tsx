'use client';
import type { Perk } from '@voidhash/db';
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
import { CopyIcon, EllipsisVerticalIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import { deletePerkAction } from '@/lib/nextjs/server-actions';
// import { EditProductModal } from "./edit-product-modal";

export function PerkRecord({ perk }: { perk: Perk }) {
  const router = useRouter();
  // const [setOpenEditModal] = useState(false);

  const { execute: deletePerk, isPending } = useAction(deletePerkAction, {
    onExecute: () => {
      toast.loading('Deleting perk...');
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success('Perk was successfully deleted');
      router.refresh();
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(
        error.error.serverError ??
          'Failed to delete the perk. Please try again.'
      );
    }
  });

  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const handleDeletePerk = async () => {
    const res = await openDialog({
      title: 'Delete perk',
      description: 'Are you sure you want to delete this perk?'
    });

    if (!res) {
      return;
    }

    deletePerk({
      perkId: perk.id
    });
  };

  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      {/* <Link
				className="inset-0 absolute w-full h-full pointer-events-"
				href={`/${organizationSlug}/${projectSlug}/monetization/perks/${perk.id}`}
			></Link> */}
      <div className="z-10 flex flex-row items-center justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex items-baseline gap-4">
            <div>{perk.name}</div>
            <code className="text-muted-foreground text-sm">{perk.slug}</code>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="z-20"
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(perk.slug);
                    toast.success('Slug (ID) copied to clipboard');
                  }}
                  size="icon"
                  variant="outline"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to copy Slug (ID)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
								Edit perk
							</DropdownMenuItem> */}

              <DropdownMenuItem
                className="cursor-pointer"
                disabled={isPending}
                onClick={handleDeletePerk}
              >
                {isPending ? 'Deleting...' : 'Delete perk'}
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
