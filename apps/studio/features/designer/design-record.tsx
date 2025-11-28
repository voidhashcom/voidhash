'use client';
import Link from 'next/link';

export function DesignRecord({
  design,
  organizationSlug,
  projectSlug
}: {
  design: {
    id: string;
    name: string;
  };
  organizationSlug: string;
  projectSlug: string;
}) {
  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <Link
        className="absolute inset-0 h-full w-full"
        href={`/${organizationSlug}/${projectSlug}/design/${design.id}`}
      />
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div>{design.name}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="z-20" size="icon" variant="outline">
                <EllipsisVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  setOpenEditModal(true);
                }}
              >
                Edit product
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={deleteProductStatus === 'pending'}
                onClick={handleDeleteProduct}
              >
                {deleteProductStatus === 'pending'
                  ? 'Deleting...'
                  : 'Delete product'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> */}
        </div>
      </div>
    </div>
  );
}
