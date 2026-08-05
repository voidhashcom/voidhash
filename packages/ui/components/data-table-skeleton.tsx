import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";

export function DataTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        {/* Rows must sit inside a <tbody>; the browser injects one otherwise,
            which desyncs SSR markup from the client tree and breaks hydration. */}
        <TableBody>
          {Array.from({ length: 10 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
