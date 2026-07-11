import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type {
  PaywallLocationTreatmentConfig,
  RpcExperimentTreatment,
  RpcExperimentVariant,
} from "@voidhash/rpc";
import { EXPERIMENT_TREATMENT_TYPES } from "@voidhash/rpc";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voidhash/ui";
import { Info, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  getPaywallDraftReleaseOptions,
  listPaywallDeploysOptions,
  listPaywallLocationsOptions,
  listPaywallsOptions,
  queryKeys,
  removeExperimentTreatmentOptions,
  upsertExperimentTreatmentOptions,
} from "@/features/studio/lib/tanstack-query";

const TREATMENT_TYPE = "paywall_location" as const;

/** Narrow an unknown treatment config to the paywall_location shape. */
const asPaywallLocationConfig = (
  config: unknown,
): PaywallLocationTreatmentConfig | null => {
  if (
    typeof config === "object" &&
    config !== null &&
    "paywallLocationId" in config &&
    "paywallId" in config &&
    "paywallReleaseId" in config
  ) {
    return config as PaywallLocationTreatmentConfig;
  }
  return null;
};

/**
 * Resolve the set of releases a user can bind for a given paywall. The backend
 * exposes no dedicated "list releases" RPC, so we reuse the existing paywall
 * surface: published/deployed releases come from `ListPaywallDeploys` (matched
 * by the paywall's slug) and the current draft comes from
 * `GetPaywallDraftRelease`. Deduplicated by release id, newest version first.
 */
function useReleaseOptions(projectId: string, paywallId: string, paywallSlug: string | undefined) {
  const { data: deploys = [] } = useQuery({
    ...listPaywallDeploysOptions({ projectId }),
    enabled: paywallId.length > 0,
  });
  const { data: draft } = useQuery({
    ...getPaywallDraftReleaseOptions({ paywallId }),
    enabled: paywallId.length > 0,
  });

  return useMemo(() => {
    const byReleaseId = new Map<string, { releaseId: string; version: number | null }>();
    if (paywallSlug) {
      for (const deploy of deploys) {
        for (const paywall of deploy.paywalls) {
          if (paywall.slug === paywallSlug && paywall.releaseId) {
            byReleaseId.set(paywall.releaseId, {
              releaseId: paywall.releaseId,
              version: paywall.version,
            });
          }
        }
      }
    }
    if (draft) {
      byReleaseId.set(draft.releaseId, {
        releaseId: draft.releaseId,
        version: draft.version,
      });
    }
    return Array.from(byReleaseId.values()).sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  }, [deploys, draft, paywallSlug]);
}

function VariantTreatmentEditor({
  experimentId,
  projectId,
  readOnly,
  variant,
  treatment,
}: {
  experimentId: string;
  projectId: string;
  readOnly?: boolean;
  variant: typeof RpcExperimentVariant.Type;
  treatment: typeof RpcExperimentTreatment.Type | undefined;
}) {
  const existingConfig = treatment ? asPaywallLocationConfig(treatment.config) : null;

  const [paywallLocationId, setPaywallLocationId] = useState(
    existingConfig?.paywallLocationId ?? "",
  );
  const [paywallId, setPaywallId] = useState(existingConfig?.paywallId ?? "");
  const [paywallReleaseId, setPaywallReleaseId] = useState(
    existingConfig?.paywallReleaseId ?? "",
  );

  const queryClient = useQueryClient();

  const { data: locations } = useSuspenseQuery(listPaywallLocationsOptions({ projectId }));
  const { data: paywalls } = useSuspenseQuery(listPaywallsOptions({ projectId }));

  const selectedPaywall = paywalls.find((paywall) => paywall.id === paywallId);
  const releaseOptions = useReleaseOptions(projectId, paywallId, selectedPaywall?.slug);

  const upsertTreatment = useMutation({
    ...upsertExperimentTreatmentOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.experiment.getExperiment(experimentId),
      });
    },
  });

  const removeTreatment = useMutation({
    ...removeExperimentTreatmentOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.experiment.getExperiment(experimentId),
      });
    },
  });

  const canSave =
    paywallLocationId.length > 0 && paywallId.length > 0 && paywallReleaseId.length > 0;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{variant.name || variant.key}</span>
          {variant.isControl && <Badge variant="outline">Control</Badge>}
          <span className="font-mono text-muted-foreground text-xs">{variant.key}</span>
        </div>
        {treatment && (
          <Button
            disabled={readOnly || removeTreatment.isPending}
            onClick={() => removeTreatment.mutate({ id: treatment.id })}
            size="icon"
            variant="ghost"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Location</Label>
          <Select
            disabled={readOnly}
            onValueChange={setPaywallLocationId}
            value={paywallLocationId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name} ({location.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Paywall</Label>
          <Select
            disabled={readOnly}
            onValueChange={(value) => {
              setPaywallId(value);
              setPaywallReleaseId("");
            }}
            value={paywallId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select paywall" />
            </SelectTrigger>
            <SelectContent>
              {paywalls.map((paywall) => (
                <SelectItem key={paywall.id} value={paywall.id}>
                  {paywall.name} ({paywall.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Release</Label>
          <Select
            disabled={readOnly || paywallId.length === 0}
            onValueChange={setPaywallReleaseId}
            value={paywallReleaseId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select release" />
            </SelectTrigger>
            <SelectContent>
              {releaseOptions.map((release) => (
                <SelectItem key={release.releaseId} value={release.releaseId}>
                  {release.version !== null ? `v${release.version}` : release.releaseId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={readOnly || !canSave || upsertTreatment.isPending}
          onClick={() =>
            upsertTreatment.mutate({
              config: { paywallId, paywallLocationId, paywallReleaseId },
              experimentId,
              treatmentType: TREATMENT_TYPE,
              variantId: variant.id,
            })
          }
          size="sm"
        >
          {upsertTreatment.isPending ? "Saving..." : treatment ? "Update Treatment" : "Add Treatment"}
        </Button>
      </div>
    </div>
  );
}

export function ExperimentTreatmentsPanel({
  experimentId,
  projectId,
  readOnly,
  treatments,
  variants,
}: {
  experimentId: string;
  projectId: string;
  readOnly?: boolean;
  treatments: readonly (typeof RpcExperimentTreatment.Type)[];
  variants: readonly (typeof RpcExperimentVariant.Type)[];
}) {
  const treatmentByVariant = useMemo(() => {
    const map = new Map<string, typeof RpcExperimentTreatment.Type>();
    for (const treatment of treatments) {
      if (treatment.treatmentType === TREATMENT_TYPE) {
        map.set(treatment.variantId, treatment);
      }
    }
    return map;
  }, [treatments]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treatments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Bind each variant to a{" "}
          <span className="font-medium">{EXPERIMENT_TREATMENT_TYPES.paywall_location.name}</span>:
          which paywall release to serve at a location for users assigned to that variant.
        </p>

        {variants.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Add variants in the Setup tab before configuring treatments.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {variants.map((variant) => (
              <VariantTreatmentEditor
                experimentId={experimentId}
                key={variant.id}
                projectId={projectId}
                readOnly={readOnly}
                treatment={treatmentByVariant.get(variant.id)}
                variant={variant}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
