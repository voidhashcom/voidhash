import { Skeleton } from "./ui/skeleton";
import { Table, TableCell, TableRow } from "./ui/table";

export function DataTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        {Array.from({ length: 10 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
