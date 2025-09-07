'use client';
import {
  UnderlineTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger
} from '@voidhash/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DevelopersTabBar({
  tabs
}: {
  tabs: { label: string; path: string }[];
}) {
  const pathname = usePathname();
  return (
    <UnderlineTabs value={pathname}>
      <UnderlineTabsList>
        <div className="mx-auto inline-flex w-full max-w-4xl items-center space-x-4 rounded-none">
          {tabs.map((tab) => (
            <UnderlineTabsTrigger
              asChild
              disabled
              key={tab.path}
              value={tab.path}
            >
              <Link href={tab.path}>{tab.label}</Link>
            </UnderlineTabsTrigger>
          ))}
        </div>
      </UnderlineTabsList>
    </UnderlineTabs>
  );
}
