import { Link } from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  cn,
  Separator,
  Skeleton
} from '@voidhash/ui';
import { Fragment } from 'react';

export function Page({
  children,
  breadcrumbs,
  className
}: React.ComponentProps<'div'> & {
  breadcrumbs?: {
    title: string;
    url?: string;
    isLoading?: boolean;
  }[];
}) {
  return (
    <>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <Separator className="mr-2 h-4" orientation="vertical" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs?.map((breadcrumb, index) => (
                  <Fragment key={breadcrumb.url ?? breadcrumb.title}>
                    {index < breadcrumbs.length - 1 && (
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink asChild>
                          <Link to={breadcrumb.url}>{breadcrumb.title}</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    )}
                    {index === breadcrumbs.length - 1 && (
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          {breadcrumb.isLoading ? (
                            <Skeleton className="h-4 w-20" />
                          ) : (
                            breadcrumb.title
                          )}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    )}
                    {index !== breadcrumbs.length - 1 && (
                      <BreadcrumbSeparator className="hidden md:block" />
                    )}
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
      )}
      <div className={cn('p-4 py-8', className)}>{children}</div>
    </>
  );
}
