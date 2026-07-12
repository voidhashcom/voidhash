"use client";

import type { RpcPaywallDeploy } from "@voidhash/rpc";
import { Badge, Button } from "@voidhash/ui";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { ActivatePaywallReleaseButton } from "./activate-paywall-release-button";

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);

const shortHash = (hash: string) => hash.slice(0, 12);

const shortDeployId = (id: string) => (id.length > 18 ? `${id.slice(0, 18)}…` : id);

interface PaywallDeployRecordProps {
  deploy: typeof RpcPaywallDeploy.Type;
  projectId: string;
}

/**
 * One row in the deploys list: deploy id, author, status and versions, with an
 * expandable detail listing the deployed paywalls (with the activate/rollback
 * affordance per release) and components.
 */
export function PaywallDeployRecord({ deploy, projectId }: PaywallDeployRecordProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium font-mono text-sm" title={deploy.id}>
              {shortDeployId(deploy.id)}
            </span>
            <Badge variant={deploy.status === "ready" ? "secondary" : "outline"}>
              {deploy.status}
            </Badge>
          </div>
          <div className="mt-1 text-muted-foreground text-xs">
            {formatDate(deploy.createdAt)} · {deploy.createdByName}
          </div>
          <div className="mt-0.5 text-muted-foreground text-xs">
            runtime v{deploy.runtimeVersion} · cli v{deploy.cliVersion}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            {deploy.paywalls.length} paywall{deploy.paywalls.length === 1 ? "" : "s"} ·{" "}
            {deploy.components.length} component{deploy.components.length === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="outline" onClick={() => setExpanded((current) => !current)}>
            {expanded ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
            {expanded ? "Hide" : "Details"}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Paywalls
            </div>
            {deploy.paywalls.length === 0 ? (
              <div className="px-3 py-2 text-muted-foreground text-sm">
                No paywalls in this deploy.
              </div>
            ) : (
              <div className="divide-y">
                {deploy.paywalls.map((paywall) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    key={`${paywall.slug}-${paywall.contentHash}`}
                  >
                    <div className="min-w-0">
                      <span className="font-medium font-mono">{paywall.slug}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {paywall.version === null ? "no release" : `v${paywall.version}`}
                      </span>
                      <span
                        className="ml-2 font-mono text-muted-foreground text-xs"
                        title={paywall.contentHash}
                      >
                        {shortHash(paywall.contentHash)}
                      </span>
                    </div>
                    {paywall.releaseId !== null ? (
                      <ActivatePaywallReleaseButton
                        paywallSlug={paywall.slug}
                        projectId={projectId}
                        releaseId={paywall.releaseId}
                        version={paywall.version}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border">
            <div className="border-b px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Components
            </div>
            {deploy.components.length === 0 ? (
              <div className="px-3 py-2 text-muted-foreground text-sm">
                No components in this deploy.
              </div>
            ) : (
              <div className="divide-y">
                {deploy.components.map((component) => (
                  <div
                    className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                    key={`${component.slug}-${component.contentHash}`}
                  >
                    <span className="font-medium font-mono">{component.slug}</span>
                    <span className="text-muted-foreground text-xs">
                      {component.version === null ? "no version" : `v${component.version}`}
                    </span>
                    <span
                      className="font-mono text-muted-foreground text-xs"
                      title={component.contentHash}
                    >
                      {shortHash(component.contentHash)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
