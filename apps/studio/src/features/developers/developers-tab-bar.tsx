"use client";
import { Link, useLocation } from "@tanstack/react-router";
import {
  UnderlineTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@voidhash/ui";

export function DevelopersTabBar({
  tabs,
}: {
  tabs: { label: string; path: string }[];
}) {
  const pathname = useLocation({
    select: (location) => location.pathname,
  });

  return (
    <UnderlineTabs value={pathname}>
      <UnderlineTabsList>
        <div className="mx-auto inline-flex w-full max-w-4xl items-center space-x-4 rounded-none">
          {tabs.map((tab) => (
            <UnderlineTabsTrigger asChild key={tab.path} value={tab.path}>
              <Link to={tab.path}>{tab.label}</Link>
            </UnderlineTabsTrigger>
          ))}
        </div>
      </UnderlineTabsList>
    </UnderlineTabs>
  );
}
