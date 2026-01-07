'use client';

import { useNavigate, useParams } from '@tanstack/react-router';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Logo
} from '@voidhash/ui';
import { ChevronDownIcon } from 'lucide-react';
import { PANEL_DIMENSIONS } from './constants';

export function TopPanel() {
  const navigate = useNavigate();
  const { organizationSlug, projectSlug } = useParams({
    strict: false
  });

  const handleGoToDashboard = () => {
    navigate({
      to: '/$organizationSlug/$projectSlug',
      params: {
        organizationSlug: organizationSlug ?? '',
        projectSlug: projectSlug ?? ''
      }
    });
  };

  return (
    <div
      className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-border border-b bg-sidebar px-3 backdrop-blur-xl"
      style={{ height: PANEL_DIMENSIONS.TOP_HEIGHT }}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
        <div className="pointer-events-auto">Test Paywall</div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center rounded-lg px-2 py-3 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
            type="button"
          >
            <Logo variant="symbol" />
            <ChevronDownIcon className="ml-2 size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onSelect={handleGoToDashboard}>
            Go to dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary">
          Share
        </Button>
        <Button size="sm">Publish</Button>
      </div>
    </div>
  );
}
