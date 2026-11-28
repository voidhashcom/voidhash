import type { VoidhashCoreClient } from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";

/**
 * Groups the core client's operations by API group. Project-scoped operations
 * take their project id from `projectId`, which the SDK resolves once per
 * client, so callers never pass it.
 */
export const groupCoreClient = <ProjectIdError>(
  client: VoidhashCoreClient,
  projectId: Effect.Effect<string, ProjectIdError>,
) => ({
  activity: {
    list: (request: {
      params: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly subjectType: string;
        readonly subjectId: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.activityList(resolvedProjectId, {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          subjectType: request.params["subjectType"],
          subjectId: request.params["subjectId"],
        }),
      ),
  },
  adAccounts: {
    create: (request: { payload: Parameters<VoidhashCoreClient["adAccountsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adAccountsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly adAccountId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adAccountsDelete(resolvedProjectId, request.params["adAccountId"]),
      ),
    get: (request: { params: { readonly adAccountId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adAccountsGet(resolvedProjectId, request.params["adAccountId"]),
      ),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adAccountsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    queryAvailable: (request: {
      payload: Parameters<VoidhashCoreClient["adAccountsQueryAvailable"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adAccountsQueryAvailable(resolvedProjectId, request.payload),
      ),
  },
  ads: {
    getAd: (request: { params: { readonly adId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsGetAd(resolvedProjectId, request.params["adId"]),
      ),
    getAdGroup: (request: { params: { readonly adGroupId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsGetAdGroup(resolvedProjectId, request.params["adGroupId"]),
      ),
    getCampaign: (request: { params: { readonly campaignId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsGetCampaign(resolvedProjectId, request.params["campaignId"]),
      ),
    getCreativePreview: (request: {
      params: { readonly creativeId: string; readonly media?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsGetCreativePreview(resolvedProjectId, request.params["creativeId"], {
          media: request.params["media"],
        }),
      ),
    getSettings: () =>
      Effect.flatMap(projectId, (resolvedProjectId) => client.adsGetSettings(resolvedProjectId)),
    listAdGroups: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly adAccountId?: string;
        readonly status?: "on" | "paused" | "removed";
        readonly deliveryStatus?:
          | "delivering"
          | "learning"
          | "learning_limited"
          | "not_delivering"
          | "in_review"
          | "rejected"
          | "paused"
          | "off_by_parent"
          | "scheduled"
          | "ended"
          | "account_issue";
        readonly destination?: "website" | "app_store" | "web_to_app" | "mixed";
        readonly search?: string;
        readonly campaignId?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsListAdGroups(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          adAccountId: request?.params?.["adAccountId"],
          status: request?.params?.["status"],
          deliveryStatus: request?.params?.["deliveryStatus"],
          destination: request?.params?.["destination"],
          search: request?.params?.["search"],
          campaignId: request?.params?.["campaignId"],
        }),
      ),
    listAds: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly adAccountId?: string;
        readonly status?: "on" | "paused" | "removed";
        readonly deliveryStatus?:
          | "delivering"
          | "learning"
          | "learning_limited"
          | "not_delivering"
          | "in_review"
          | "rejected"
          | "paused"
          | "off_by_parent"
          | "scheduled"
          | "ended"
          | "account_issue";
        readonly destination?: "website" | "app_store" | "web_to_app" | "mixed";
        readonly search?: string;
        readonly campaignId?: string;
        readonly adGroupId?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsListAds(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          adAccountId: request?.params?.["adAccountId"],
          status: request?.params?.["status"],
          deliveryStatus: request?.params?.["deliveryStatus"],
          destination: request?.params?.["destination"],
          search: request?.params?.["search"],
          campaignId: request?.params?.["campaignId"],
          adGroupId: request?.params?.["adGroupId"],
        }),
      ),
    listCampaigns: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly adAccountId?: string;
        readonly status?: "on" | "paused" | "removed";
        readonly deliveryStatus?:
          | "delivering"
          | "learning"
          | "learning_limited"
          | "not_delivering"
          | "in_review"
          | "rejected"
          | "paused"
          | "off_by_parent"
          | "scheduled"
          | "ended"
          | "account_issue";
        readonly destination?: "website" | "app_store" | "web_to_app" | "mixed";
        readonly search?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsListCampaigns(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          adAccountId: request?.params?.["adAccountId"],
          status: request?.params?.["status"],
          deliveryStatus: request?.params?.["deliveryStatus"],
          destination: request?.params?.["destination"],
          search: request?.params?.["search"],
        }),
      ),
    reportChanges: (request: { payload: Parameters<VoidhashCoreClient["adsReportChanges"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsReportChanges(resolvedProjectId, request.payload),
      ),
    reportCohorts: (request: { payload: Parameters<VoidhashCoreClient["adsReportCohorts"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsReportCohorts(resolvedProjectId, request.payload),
      ),
    reportCreatives: (request: {
      payload: Parameters<VoidhashCoreClient["adsReportCreatives"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsReportCreatives(resolvedProjectId, request.payload),
      ),
    reportPerformance: (request: {
      payload: Parameters<VoidhashCoreClient["adsReportPerformance"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsReportPerformance(resolvedProjectId, request.payload),
      ),
    updateSettings: (request: {
      payload: Parameters<VoidhashCoreClient["adsUpdateSettings"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.adsUpdateSettings(resolvedProjectId, request.payload),
      ),
  },
  analytics: {
    reportAcquisition: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsReportAcquisition"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportAcquisition(resolvedProjectId, request.payload),
      ),
    reportAcquisitionCohorts: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsReportAcquisitionCohorts"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportAcquisitionCohorts(resolvedProjectId, request.payload),
      ),
    reportCharts: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsReportCharts"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportCharts(resolvedProjectId, request.payload),
      ),
    reportInsights: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsReportInsights"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportInsights(resolvedProjectId, request.payload),
      ),
    reportLiveUsers: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportLiveUsers(resolvedProjectId),
      ),
    reportMetricActors: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsReportMetricActors"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportMetricActors(resolvedProjectId, request.payload),
      ),
    reportMetrics: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsReportMetrics"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportMetrics(resolvedProjectId, request.payload),
      ),
    reportTrackingHealth: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsReportTrackingHealth(resolvedProjectId),
      ),
  },
  analyticsAlerts: {
    create: (request: { payload: Parameters<VoidhashCoreClient["analyticsAlertsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAlertsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly alertId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAlertsDelete(resolvedProjectId, request.params["alertId"]),
      ),
    get: (request: { params: { readonly alertId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAlertsGet(resolvedProjectId, request.params["alertId"]),
      ),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAlertsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    update: (request: {
      params: { readonly alertId: string };
      payload: Parameters<VoidhashCoreClient["analyticsAlertsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAlertsUpdate(resolvedProjectId, request.params["alertId"], request.payload),
      ),
  },
  analyticsAnnotations: {
    create: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsAnnotationsCreate"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAnnotationsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly annotationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAnnotationsDelete(resolvedProjectId, request.params["annotationId"]),
      ),
    get: (request: { params: { readonly annotationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAnnotationsGet(resolvedProjectId, request.params["annotationId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly from?: string;
        readonly to?: string;
        readonly search?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAnnotationsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          from: request?.params?.["from"],
          to: request?.params?.["to"],
          search: request?.params?.["search"],
        }),
      ),
    update: (request: {
      params: { readonly annotationId: string };
      payload: Parameters<VoidhashCoreClient["analyticsAnnotationsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsAnnotationsUpdate(
          resolvedProjectId,
          request.params["annotationId"],
          request.payload,
        ),
      ),
  },
  analyticsCohorts: {
    addPeople: (request: {
      params: { readonly cohortId: string };
      payload: Parameters<VoidhashCoreClient["analyticsCohortsAddPeople"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsAddPeople(
          resolvedProjectId,
          request.params["cohortId"],
          request.payload,
        ),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["analyticsCohortsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly cohortId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsDelete(resolvedProjectId, request.params["cohortId"]),
      ),
    evaluate: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsCohortsEvaluate"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsEvaluate(resolvedProjectId, request.payload),
      ),
    get: (request: { params: { readonly cohortId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsGet(resolvedProjectId, request.params["cohortId"]),
      ),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    listPeople: (request: {
      params: {
        readonly cohortId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly search?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsListPeople(resolvedProjectId, request.params["cohortId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          search: request.params["search"],
        }),
      ),
    removePerson: (request: { params: { readonly cohortId: string; readonly personId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsRemovePerson(
          resolvedProjectId,
          request.params["cohortId"],
          request.params["personId"],
        ),
      ),
    update: (request: {
      params: { readonly cohortId: string };
      payload: Parameters<VoidhashCoreClient["analyticsCohortsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsCohortsUpdate(
          resolvedProjectId,
          request.params["cohortId"],
          request.payload,
        ),
      ),
  },
  analyticsGroups: {
    delete: (request: { params: { readonly groupId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsGroupsDelete(resolvedProjectId, request.params["groupId"]),
      ),
    get: (request: { params: { readonly groupId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsGroupsGet(resolvedProjectId, request.params["groupId"]),
      ),
    list: (request: {
      params: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly groupType: string;
        readonly key?: string;
        readonly search?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsGroupsList(resolvedProjectId, {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          groupType: request.params["groupType"],
          key: request.params["key"],
          search: request.params["search"],
        }),
      ),
    listPeople: (request: {
      params: {
        readonly groupId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly days?: number;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsGroupsListPeople(resolvedProjectId, request.params["groupId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          days: request.params["days"],
        }),
      ),
    update: (request: {
      params: { readonly groupId: string };
      payload: Parameters<VoidhashCoreClient["analyticsGroupsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsGroupsUpdate(resolvedProjectId, request.params["groupId"], request.payload),
      ),
  },
  analyticsGroupTypes: {
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsGroupTypesList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    update: (request: {
      params: { readonly groupTypeId: string };
      payload: Parameters<VoidhashCoreClient["analyticsGroupTypesUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.analyticsGroupTypesUpdate(
          resolvedProjectId,
          request.params["groupTypeId"],
          request.payload,
        ),
      ),
  },
  apiKeys: {
    create: (request: { payload: Parameters<VoidhashCoreClient["apiKeysCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.apiKeysCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly apiKeyId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.apiKeysDelete(resolvedProjectId, request.params["apiKeyId"]),
      ),
    get: (request: { params: { readonly apiKeyId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.apiKeysGet(resolvedProjectId, request.params["apiKeyId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly type?: "publishable" | "secret";
        readonly environment?: "production" | "test";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.apiKeysList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          type: request?.params?.["type"],
          environment: request?.params?.["environment"],
        }),
      ),
    rotate: (request: {
      params: { readonly apiKeyId: string };
      payload: Parameters<VoidhashCoreClient["apiKeysRotate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.apiKeysRotate(resolvedProjectId, request.params["apiKeyId"], request.payload),
      ),
    update: (request: {
      params: { readonly apiKeyId: string };
      payload: Parameters<VoidhashCoreClient["apiKeysUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.apiKeysUpdate(resolvedProjectId, request.params["apiKeyId"], request.payload),
      ),
  },
  assets: {
    get: (request: { params: { readonly assetId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.assetsGet(resolvedProjectId, request.params["assetId"]),
      ),
    getPreview: (request: { params: { readonly assetId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.assetsGetPreview(resolvedProjectId, request.params["assetId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly kind?: "image" | "video" | "font" | "document";
        readonly search?: string;
        readonly url?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.assetsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          kind: request?.params?.["kind"],
          search: request?.params?.["search"],
          url: request?.params?.["url"],
        }),
      ),
  },
  auditLog: {
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly entityType?: string;
        readonly entityId?: string;
        readonly parentEntityId?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.auditLogList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          entityType: request?.params?.["entityType"],
          entityId: request?.params?.["entityId"],
          parentEntityId: request?.params?.["parentEntityId"],
        }),
      ),
  },
  automations: {
    activate: (request: { params: { readonly automationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsActivate(resolvedProjectId, request.params["automationId"]),
      ),
    archive: (request: { params: { readonly automationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsArchive(resolvedProjectId, request.params["automationId"]),
      ),
    cancelRun: (request: { params: { readonly runId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsCancelRun(resolvedProjectId, request.params["runId"]),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["automationsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsCreate(resolvedProjectId, request.payload),
      ),
    createRun: (request: {
      params: { readonly automationId: string };
      payload: Parameters<VoidhashCoreClient["automationsCreateRun"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsCreateRun(
          resolvedProjectId,
          request.params["automationId"],
          request.payload,
        ),
      ),
    explain: (request: { params: { readonly automationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsExplain(resolvedProjectId, request.params["automationId"]),
      ),
    get: (request: { params: { readonly automationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsGet(resolvedProjectId, request.params["automationId"]),
      ),
    getCatalog: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsGetCatalog(resolvedProjectId),
      ),
    getRun: (request: { params: { readonly runId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsGetRun(resolvedProjectId, request.params["runId"]),
      ),
    getStats: (request: { params: { readonly automationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsGetStats(resolvedProjectId, request.params["automationId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly isArchived?: "true" | "false";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          isArchived: request?.params?.["isArchived"],
        }),
      ),
    listCohorts: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsListCohorts(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    listRuns: (request: {
      params: {
        readonly automationId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly personId?: string;
        readonly status?:
          | "queued"
          | "running"
          | "waiting"
          | "paused"
          | "completed"
          | "failed"
          | "cancelled"
          | "exited";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsListRuns(resolvedProjectId, request.params["automationId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          personId: request.params["personId"],
          status: request.params["status"],
        }),
      ),
    listVersions: (request: {
      params: { readonly automationId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsListVersions(resolvedProjectId, request.params["automationId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    pause: (request: { params: { readonly automationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsPause(resolvedProjectId, request.params["automationId"]),
      ),
    retryRun: (request: { params: { readonly runId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsRetryRun(resolvedProjectId, request.params["runId"]),
      ),
    test: (request: {
      params: { readonly automationId: string };
      payload: Parameters<VoidhashCoreClient["automationsTest"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsTest(resolvedProjectId, request.params["automationId"], request.payload),
      ),
    unarchive: (request: { params: { readonly automationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsUnarchive(resolvedProjectId, request.params["automationId"]),
      ),
    update: (request: {
      params: { readonly automationId: string };
      payload: Parameters<VoidhashCoreClient["automationsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.automationsUpdate(
          resolvedProjectId,
          request.params["automationId"],
          request.payload,
        ),
      ),
  },
  boards: {
    archiveTask: (request: { params: { readonly boardId: string; readonly taskId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsArchiveTask(
          resolvedProjectId,
          request.params["boardId"],
          request.params["taskId"],
        ),
      ),
    createColumn: (request: {
      params: { readonly boardId: string };
      payload: Parameters<VoidhashCoreClient["boardsCreateColumn"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsCreateColumn(resolvedProjectId, request.params["boardId"], request.payload),
      ),
    createLabel: (request: {
      params: { readonly boardId: string };
      payload: Parameters<VoidhashCoreClient["boardsCreateLabel"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsCreateLabel(resolvedProjectId, request.params["boardId"], request.payload),
      ),
    createTask: (request: {
      params: { readonly boardId: string; readonly "idempotency-key"?: string };
      payload: Parameters<VoidhashCoreClient["boardsCreateTask"]>[2]["payload"];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsCreateTask(resolvedProjectId, request.params["boardId"], {
          params: { "idempotency-key": request.params["idempotency-key"] },
          payload: request.payload,
        }),
      ),
    deleteColumn: (request: {
      params: { readonly boardId: string; readonly columnId: string; readonly moveTasksTo: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsDeleteColumn(
          resolvedProjectId,
          request.params["boardId"],
          request.params["columnId"],
          { moveTasksTo: request.params["moveTasksTo"] },
        ),
      ),
    deleteLabel: (request: { params: { readonly boardId: string; readonly labelId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsDeleteLabel(
          resolvedProjectId,
          request.params["boardId"],
          request.params["labelId"],
        ),
      ),
    get: (request: { params: { readonly boardId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsGet(resolvedProjectId, request.params["boardId"]),
      ),
    getTask: (request: { params: { readonly boardId: string; readonly taskId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsGetTask(
          resolvedProjectId,
          request.params["boardId"],
          request.params["taskId"],
        ),
      ),
    listTasks: (request: {
      params: {
        readonly boardId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly columnId?: string;
        readonly assignee?: string;
        readonly labelId?: string;
        readonly priority?: "none" | "low" | "medium" | "high" | "urgent";
        readonly isArchived?: "true" | "false";
        readonly text?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsListTasks(resolvedProjectId, request.params["boardId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          columnId: request.params["columnId"],
          assignee: request.params["assignee"],
          labelId: request.params["labelId"],
          priority: request.params["priority"],
          isArchived: request.params["isArchived"],
          text: request.params["text"],
        }),
      ),
    unarchiveTask: (request: { params: { readonly boardId: string; readonly taskId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsUnarchiveTask(
          resolvedProjectId,
          request.params["boardId"],
          request.params["taskId"],
        ),
      ),
    updateColumn: (request: {
      params: { readonly boardId: string; readonly columnId: string };
      payload: Parameters<VoidhashCoreClient["boardsUpdateColumn"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsUpdateColumn(
          resolvedProjectId,
          request.params["boardId"],
          request.params["columnId"],
          request.payload,
        ),
      ),
    updateLabel: (request: {
      params: { readonly boardId: string; readonly labelId: string };
      payload: Parameters<VoidhashCoreClient["boardsUpdateLabel"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsUpdateLabel(
          resolvedProjectId,
          request.params["boardId"],
          request.params["labelId"],
          request.payload,
        ),
      ),
    updateTask: (request: {
      params: { readonly boardId: string; readonly taskId: string };
      payload: Parameters<VoidhashCoreClient["boardsUpdateTask"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.boardsUpdateTask(
          resolvedProjectId,
          request.params["boardId"],
          request.params["taskId"],
          request.payload,
        ),
      ),
  },
  comments: {
    addReaction: (request: { params: { readonly commentId: string; readonly emoji: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.commentsAddReaction(
          resolvedProjectId,
          request.params["commentId"],
          request.params["emoji"],
        ),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["commentsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.commentsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly commentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.commentsDelete(resolvedProjectId, request.params["commentId"]),
      ),
    list: (request: {
      params: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly subjectType: string;
        readonly subjectId: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.commentsList(resolvedProjectId, {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          subjectType: request.params["subjectType"],
          subjectId: request.params["subjectId"],
        }),
      ),
    removeReaction: (request: { params: { readonly commentId: string; readonly emoji: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.commentsRemoveReaction(
          resolvedProjectId,
          request.params["commentId"],
          request.params["emoji"],
        ),
      ),
    update: (request: {
      params: { readonly commentId: string };
      payload: Parameters<VoidhashCoreClient["commentsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.commentsUpdate(resolvedProjectId, request.params["commentId"], request.payload),
      ),
  },
  componentDevSessions: {
    create: (request: {
      payload: Parameters<VoidhashCoreClient["componentDevSessionsCreate"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentDevSessionsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly devSessionId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentDevSessionsDelete(resolvedProjectId, request.params["devSessionId"]),
      ),
    get: (request: { params: { readonly devSessionId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentDevSessionsGet(resolvedProjectId, request.params["devSessionId"]),
      ),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentDevSessionsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    update: (request: {
      params: { readonly devSessionId: string };
      payload: Parameters<VoidhashCoreClient["componentDevSessionsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentDevSessionsUpdate(
          resolvedProjectId,
          request.params["devSessionId"],
          request.payload,
        ),
      ),
  },
  componentRegistry: {
    createInstall: (request: {
      payload: Parameters<VoidhashCoreClient["componentRegistryCreateInstall"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryCreateInstall(resolvedProjectId, request.payload),
      ),
    createVersionFromBundle: (request: {
      payload: Parameters<VoidhashCoreClient["componentRegistryCreateVersionFromBundle"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryCreateVersionFromBundle(resolvedProjectId, request.payload),
      ),
    createVersionFromComponent: (request: {
      payload: Parameters<VoidhashCoreClient["componentRegistryCreateVersionFromComponent"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryCreateVersionFromComponent(resolvedProjectId, request.payload),
      ),
    deleteInstall: (request: { params: { readonly installId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryDeleteInstall(resolvedProjectId, request.params["installId"]),
      ),
    get: (request: { params: { readonly registryComponentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryGet(resolvedProjectId, request.params["registryComponentId"]),
      ),
    getInstall: (request: { params: { readonly installId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryGetInstall(resolvedProjectId, request.params["installId"]),
      ),
    getInstallReview: (request: {
      params: { readonly registryComponentId: string; readonly versionRange?: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryGetInstallReview(
          resolvedProjectId,
          request.params["registryComponentId"],
          { versionRange: request.params["versionRange"] },
        ),
      ),
    getPublisher: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryGetPublisher(resolvedProjectId),
      ),
    getVersion: (request: {
      params: { readonly registryComponentId: string; readonly versionId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryGetVersion(
          resolvedProjectId,
          request.params["registryComponentId"],
          request.params["versionId"],
        ),
      ),
    getVersionFile: (request: {
      params: {
        readonly registryComponentId: string;
        readonly file: "icon" | "thumbnail" | "readme" | "agent_guide";
        readonly versionId: string;
        readonly state?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryGetVersionFile(
          resolvedProjectId,
          request.params["registryComponentId"],
          request.params["file"],
          { versionId: request.params["versionId"], state: request.params["state"] },
        ),
      ),
    list: (request?: {
      params?: { readonly cursor?: string; readonly limit?: number; readonly slug?: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          slug: request?.params?.["slug"],
        }),
      ),
    listInstalls: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryListInstalls(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    listVersions: (request: {
      params: {
        readonly registryComponentId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly version?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryListVersions(
          resolvedProjectId,
          request.params["registryComponentId"],
          {
            cursor: request.params["cursor"],
            limit: request.params["limit"],
            version: request.params["version"],
          },
        ),
      ),
    update: (request: {
      params: { readonly registryComponentId: string };
      payload: Parameters<VoidhashCoreClient["componentRegistryUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryUpdate(
          resolvedProjectId,
          request.params["registryComponentId"],
          request.payload,
        ),
      ),
    updateInstall: (request: {
      params: { readonly installId: string };
      payload: Parameters<VoidhashCoreClient["componentRegistryUpdateInstall"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryUpdateInstall(
          resolvedProjectId,
          request.params["installId"],
          request.payload,
        ),
      ),
    updateVersion: (request: {
      params: { readonly registryComponentId: string; readonly versionId: string };
      payload: Parameters<VoidhashCoreClient["componentRegistryUpdateVersion"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryUpdateVersion(
          resolvedProjectId,
          request.params["registryComponentId"],
          request.params["versionId"],
          request.payload,
        ),
      ),
    upsertPublisher: (request: {
      payload: Parameters<VoidhashCoreClient["componentRegistryUpsertPublisher"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentRegistryUpsertPublisher(resolvedProjectId, request.payload),
      ),
  },
  components: {
    createVersionFromModule: (request: {
      payload: Parameters<VoidhashCoreClient["componentsCreateVersionFromModule"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsCreateVersionFromModule(resolvedProjectId, request.payload),
      ),
    createVersionFromSource: (request: {
      payload: Parameters<VoidhashCoreClient["componentsCreateVersionFromSource"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsCreateVersionFromSource(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly componentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsDelete(resolvedProjectId, request.params["componentId"]),
      ),
    get: (request: { params: { readonly componentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsGet(resolvedProjectId, request.params["componentId"]),
      ),
    getVersion: (request: {
      params: { readonly componentId: string; readonly versionId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsGetVersion(
          resolvedProjectId,
          request.params["componentId"],
          request.params["versionId"],
        ),
      ),
    list: (request?: {
      params?: { readonly cursor?: string; readonly limit?: number; readonly slug?: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          slug: request?.params?.["slug"],
        }),
      ),
    listUses: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsListUses(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    listVersions: (request: {
      params: {
        readonly componentId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly version?: number;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsListVersions(resolvedProjectId, request.params["componentId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          version: request.params["version"],
        }),
      ),
    update: (request: {
      params: { readonly componentId: string };
      payload: Parameters<VoidhashCoreClient["componentsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsUpdate(resolvedProjectId, request.params["componentId"], request.payload),
      ),
    updateVersion: (request: {
      params: { readonly componentId: string; readonly versionId: string };
      payload: Parameters<VoidhashCoreClient["componentsUpdateVersion"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.componentsUpdateVersion(
          resolvedProjectId,
          request.params["componentId"],
          request.params["versionId"],
          request.payload,
        ),
      ),
  },
  connectedApps: {
    delete: (request: { params: { readonly connectedAppId: string } }) =>
      client.connectedAppsDelete(request.params["connectedAppId"]),
    get: (request: { params: { readonly connectedAppId: string } }) =>
      client.connectedAppsGet(request.params["connectedAppId"]),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      client.connectedAppsList({
        cursor: request?.params?.["cursor"],
        limit: request?.params?.["limit"],
      }),
    update: (request: {
      params: { readonly connectedAppId: string };
      payload: Parameters<VoidhashCoreClient["connectedAppsUpdate"]>[1];
    }) => client.connectedAppsUpdate(request.params["connectedAppId"], request.payload),
  },
  events: {
    list: (request?: {
      params?: { readonly cursor?: string; readonly limit?: number; readonly name?: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.eventsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          name: request?.params?.["name"],
        }),
      ),
  },
  experiments: {
    archive: (request: { params: { readonly experimentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsArchive(resolvedProjectId, request.params["experimentId"]),
      ),
    conclude: (request: {
      params: { readonly experimentId: string };
      payload: Parameters<VoidhashCoreClient["experimentsConclude"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsConclude(
          resolvedProjectId,
          request.params["experimentId"],
          request.payload,
        ),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["experimentsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsCreate(resolvedProjectId, request.payload),
      ),
    deployVariant: (request: {
      params: { readonly experimentId: string; readonly variantId: string };
      payload: Parameters<VoidhashCoreClient["experimentsDeployVariant"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsDeployVariant(
          resolvedProjectId,
          request.params["experimentId"],
          request.params["variantId"],
          request.payload,
        ),
      ),
    get: (request: { params: { readonly experimentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsGet(resolvedProjectId, request.params["experimentId"]),
      ),
    getResults: (request: { params: { readonly experimentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsGetResults(resolvedProjectId, request.params["experimentId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly status?: "draft" | "running" | "paused" | "concluded";
        readonly isArchived?: "true" | "false";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          status: request?.params?.["status"],
          isArchived: request?.params?.["isArchived"],
        }),
      ),
    listVariants: (request: {
      params: { readonly experimentId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsListVariants(resolvedProjectId, request.params["experimentId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    pause: (request: { params: { readonly experimentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsPause(resolvedProjectId, request.params["experimentId"]),
      ),
    replaceVariants: (request: {
      params: { readonly experimentId: string };
      payload: Parameters<VoidhashCoreClient["experimentsReplaceVariants"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsReplaceVariants(
          resolvedProjectId,
          request.params["experimentId"],
          request.payload,
        ),
      ),
    start: (request: { params: { readonly experimentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsStart(resolvedProjectId, request.params["experimentId"]),
      ),
    unarchive: (request: { params: { readonly experimentId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsUnarchive(resolvedProjectId, request.params["experimentId"]),
      ),
    update: (request: {
      params: { readonly experimentId: string };
      payload: Parameters<VoidhashCoreClient["experimentsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.experimentsUpdate(
          resolvedProjectId,
          request.params["experimentId"],
          request.payload,
        ),
      ),
  },
  featureFlags: {
    archive: (request: { params: { readonly featureFlagId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsArchive(resolvedProjectId, request.params["featureFlagId"]),
      ),
    clearEnvironment: (request: {
      params: { readonly featureFlagId: string; readonly environment: "production" | "test" };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsClearEnvironment(
          resolvedProjectId,
          request.params["featureFlagId"],
          request.params["environment"],
        ),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["featureFlagsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsCreate(resolvedProjectId, request.payload),
      ),
    evaluate: (request: { payload: Parameters<VoidhashCoreClient["featureFlagsEvaluate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsEvaluate(resolvedProjectId, request.payload),
      ),
    get: (request: { params: { readonly featureFlagId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsGet(resolvedProjectId, request.params["featureFlagId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly key?: string;
        readonly isArchived?: "true" | "false";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          key: request?.params?.["key"],
          isArchived: request?.params?.["isArchived"],
        }),
      ),
    listOverrides: (request: {
      params: {
        readonly featureFlagId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly environment?: "production" | "test";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsListOverrides(resolvedProjectId, request.params["featureFlagId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          environment: request.params["environment"],
        }),
      ),
    listOverridesByIdentity: (request: {
      params: { readonly cursor?: string; readonly limit?: number; readonly identity: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsListOverridesByIdentity(resolvedProjectId, {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          identity: request.params["identity"],
        }),
      ),
    listVariants: (request: {
      params: { readonly featureFlagId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsListVariants(resolvedProjectId, request.params["featureFlagId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    removeOverride: (request: {
      params: {
        readonly featureFlagId: string;
        readonly identity: string;
        readonly environment?: "production" | "test";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsRemoveOverride(
          resolvedProjectId,
          request.params["featureFlagId"],
          request.params["identity"],
          { environment: request.params["environment"] },
        ),
      ),
    replaceVariants: (request: {
      params: { readonly featureFlagId: string };
      payload: Parameters<VoidhashCoreClient["featureFlagsReplaceVariants"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsReplaceVariants(
          resolvedProjectId,
          request.params["featureFlagId"],
          request.payload,
        ),
      ),
    setEnvironment: (request: {
      params: { readonly featureFlagId: string; readonly environment: "production" | "test" };
      payload: Parameters<VoidhashCoreClient["featureFlagsSetEnvironment"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsSetEnvironment(
          resolvedProjectId,
          request.params["featureFlagId"],
          request.params["environment"],
          request.payload,
        ),
      ),
    unarchive: (request: { params: { readonly featureFlagId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsUnarchive(resolvedProjectId, request.params["featureFlagId"]),
      ),
    update: (request: {
      params: { readonly featureFlagId: string };
      payload: Parameters<VoidhashCoreClient["featureFlagsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsUpdate(
          resolvedProjectId,
          request.params["featureFlagId"],
          request.payload,
        ),
      ),
    upsertOverride: (request: {
      params: {
        readonly featureFlagId: string;
        readonly identity: string;
        readonly environment?: "production" | "test";
      };
      payload: Parameters<VoidhashCoreClient["featureFlagsUpsertOverride"]>[3]["payload"];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.featureFlagsUpsertOverride(
          resolvedProjectId,
          request.params["featureFlagId"],
          request.params["identity"],
          { params: { environment: request.params["environment"] }, payload: request.payload },
        ),
      ),
  },
  feedback: {
    create: (request: { payload: Parameters<VoidhashCoreClient["feedbackCreate"]>[0] }) =>
      client.feedbackCreate(request.payload),
  },
  files: {
    archive: (request: { params: { readonly fileId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.filesArchive(resolvedProjectId, request.params["fileId"]),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["filesCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.filesCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly fileId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.filesDelete(resolvedProjectId, request.params["fileId"]),
      ),
    get: (request: { params: { readonly fileId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.filesGet(resolvedProjectId, request.params["fileId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly parentId?: string;
        readonly kind?: "folder" | "board" | "dashboard" | "report";
        readonly isArchived?: "true" | "false";
        readonly sort?: "name" | "recent";
        readonly search?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.filesList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          parentId: request?.params?.["parentId"],
          kind: request?.params?.["kind"],
          isArchived: request?.params?.["isArchived"],
          sort: request?.params?.["sort"],
          search: request?.params?.["search"],
        }),
      ),
    unarchive: (request: { params: { readonly fileId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.filesUnarchive(resolvedProjectId, request.params["fileId"]),
      ),
    update: (request: {
      params: { readonly fileId: string };
      payload: Parameters<VoidhashCoreClient["filesUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.filesUpdate(resolvedProjectId, request.params["fileId"], request.payload),
      ),
  },
  inbox: {
    archive: (request: { payload: Parameters<VoidhashCoreClient["inboxArchive"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.inboxArchive(resolvedProjectId, request.payload),
      ),
    getUnreadCount: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.inboxGetUnreadCount(resolvedProjectId),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly isUnread?: "true" | "false";
        readonly isArchived?: "true" | "false";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.inboxList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          isUnread: request?.params?.["isUnread"],
          isArchived: request?.params?.["isArchived"],
        }),
      ),
    markRead: (request: { payload: Parameters<VoidhashCoreClient["inboxMarkRead"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.inboxMarkRead(resolvedProjectId, request.payload),
      ),
    markUnread: (request: { payload: Parameters<VoidhashCoreClient["inboxMarkUnread"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.inboxMarkUnread(resolvedProjectId, request.payload),
      ),
    unarchive: (request: { payload: Parameters<VoidhashCoreClient["inboxUnarchive"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.inboxUnarchive(resolvedProjectId, request.payload),
      ),
  },
  ingestPolicy: {
    get: () =>
      Effect.flatMap(projectId, (resolvedProjectId) => client.ingestPolicyGet(resolvedProjectId)),
    upsertBuiltinEvent: (request: {
      params: { readonly key: string };
      payload: Parameters<VoidhashCoreClient["ingestPolicyUpsertBuiltinEvent"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.ingestPolicyUpsertBuiltinEvent(
          resolvedProjectId,
          request.params["key"],
          request.payload,
        ),
      ),
    upsertCustomEvent: (request: {
      params: { readonly eventName: string };
      payload: Parameters<VoidhashCoreClient["ingestPolicyUpsertCustomEvent"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.ingestPolicyUpsertCustomEvent(
          resolvedProjectId,
          request.params["eventName"],
          request.payload,
        ),
      ),
  },
  me: {
    get: () => client.meGet(),
    removeAvatar: () => client.meRemoveAvatar(),
    setAvatar: (request: { payload: Parameters<VoidhashCoreClient["meSetAvatar"]>[0] }) =>
      client.meSetAvatar(request.payload),
  },
  metaMeasurement: {
    getSettings: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.metaMeasurementGetSettings(resolvedProjectId),
      ),
    updateSettings: (request: {
      payload: Parameters<VoidhashCoreClient["metaMeasurementUpdateSettings"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.metaMeasurementUpdateSettings(resolvedProjectId, request.payload),
      ),
  },
  notices: {
    archive: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["noticesArchive"]>[1];
    }) => client.noticesArchive(request.params["organizationId"], request.payload),
    getPreferences: (request: { params: { readonly organizationId: string } }) =>
      client.noticesGetPreferences(request.params["organizationId"]),
    getUnreadCount: (request: { params: { readonly organizationId: string } }) =>
      client.noticesGetUnreadCount(request.params["organizationId"]),
    list: (request: {
      params: {
        readonly organizationId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly isArchived?: "true" | "false";
      };
    }) =>
      client.noticesList(request.params["organizationId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        isArchived: request.params["isArchived"],
      }),
    markRead: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["noticesMarkRead"]>[1];
    }) => client.noticesMarkRead(request.params["organizationId"], request.payload),
    unarchive: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["noticesUnarchive"]>[1];
    }) => client.noticesUnarchive(request.params["organizationId"], request.payload),
    updatePreferences: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["noticesUpdatePreferences"]>[1];
    }) => client.noticesUpdatePreferences(request.params["organizationId"], request.payload),
  },
  organizationInvitations: {
    create: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["organizationInvitationsCreate"]>[1];
    }) => client.organizationInvitationsCreate(request.params["organizationId"], request.payload),
    delete: (request: {
      params: { readonly organizationId: string; readonly invitationId: string };
    }) =>
      client.organizationInvitationsDelete(
        request.params["organizationId"],
        request.params["invitationId"],
      ),
    get: (request: {
      params: { readonly organizationId: string; readonly invitationId: string };
    }) =>
      client.organizationInvitationsGet(
        request.params["organizationId"],
        request.params["invitationId"],
      ),
    list: (request: {
      params: {
        readonly organizationId: string;
        readonly cursor?: string;
        readonly limit?: number;
      };
    }) =>
      client.organizationInvitationsList(request.params["organizationId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
      }),
  },
  organizationMembers: {
    create: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["organizationMembersCreate"]>[1];
    }) => client.organizationMembersCreate(request.params["organizationId"], request.payload),
    delete: (request: { params: { readonly organizationId: string; readonly memberId: string } }) =>
      client.organizationMembersDelete(
        request.params["organizationId"],
        request.params["memberId"],
      ),
    get: (request: { params: { readonly organizationId: string; readonly memberId: string } }) =>
      client.organizationMembersGet(request.params["organizationId"], request.params["memberId"]),
    list: (request: {
      params: {
        readonly organizationId: string;
        readonly cursor?: string;
        readonly limit?: number;
      };
    }) =>
      client.organizationMembersList(request.params["organizationId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
      }),
    update: (request: {
      params: { readonly organizationId: string; readonly memberId: string };
      payload: Parameters<VoidhashCoreClient["organizationMembersUpdate"]>[2];
    }) =>
      client.organizationMembersUpdate(
        request.params["organizationId"],
        request.params["memberId"],
        request.payload,
      ),
  },
  organizations: {
    create: (request: { payload: Parameters<VoidhashCoreClient["organizationsCreate"]>[0] }) =>
      client.organizationsCreate(request.payload),
    delete: (request: { params: { readonly organizationId: string } }) =>
      client.organizationsDelete(request.params["organizationId"]),
    get: (request: { params: { readonly organizationId: string } }) =>
      client.organizationsGet(request.params["organizationId"]),
    getSettings: (request: { params: { readonly organizationId: string } }) =>
      client.organizationsGetSettings(request.params["organizationId"]),
    list: (request?: {
      params?: { readonly cursor?: string; readonly limit?: number; readonly slug?: string };
    }) =>
      client.organizationsList({
        cursor: request?.params?.["cursor"],
        limit: request?.params?.["limit"],
        slug: request?.params?.["slug"],
      }),
    removeAvatar: (request: { params: { readonly organizationId: string } }) =>
      client.organizationsRemoveAvatar(request.params["organizationId"]),
    setAvatar: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["organizationsSetAvatar"]>[1];
    }) => client.organizationsSetAvatar(request.params["organizationId"], request.payload),
    update: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["organizationsUpdate"]>[1];
    }) => client.organizationsUpdate(request.params["organizationId"], request.payload),
    updateSettings: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["organizationsUpdateSettings"]>[1];
    }) => client.organizationsUpdateSettings(request.params["organizationId"], request.payload),
  },
  participants: {
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.participantsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
  },
  paymentProviderHistoryImports: {
    addIdentifiers: (request: {
      params: { readonly paymentProviderId: string; readonly importId: string };
      payload: Parameters<VoidhashCoreClient["paymentProviderHistoryImportsAddIdentifiers"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderHistoryImportsAddIdentifiers(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["importId"],
          request.payload,
        ),
      ),
    cancel: (request: {
      params: { readonly paymentProviderId: string; readonly importId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderHistoryImportsCancel(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["importId"],
        ),
      ),
    conclude: (request: {
      params: { readonly paymentProviderId: string; readonly importId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderHistoryImportsConclude(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["importId"],
        ),
      ),
    create: (request: {
      params: { readonly paymentProviderId: string };
      payload: Parameters<VoidhashCoreClient["paymentProviderHistoryImportsCreate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderHistoryImportsCreate(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.payload,
        ),
      ),
    get: (request: { params: { readonly paymentProviderId: string; readonly importId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderHistoryImportsGet(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["importId"],
        ),
      ),
    list: (request: {
      params: {
        readonly paymentProviderId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly environment?: "production" | "test";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderHistoryImportsList(
          resolvedProjectId,
          request.params["paymentProviderId"],
          {
            cursor: request.params["cursor"],
            limit: request.params["limit"],
            environment: request.params["environment"],
          },
        ),
      ),
    listIdentifiers: (request: {
      params: {
        readonly paymentProviderId: string;
        readonly importId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly outcome?:
          | "pending"
          | "imported"
          | "already_known"
          | "waiting_for_product"
          | "not_found"
          | "other_environment"
          | "no_longer_available"
          | "not_paid"
          | "other_app"
          | "invalid";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderHistoryImportsListIdentifiers(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["importId"],
          {
            cursor: request.params["cursor"],
            limit: request.params["limit"],
            outcome: request.params["outcome"],
          },
        ),
      ),
  },
  paymentProviderProducts: {
    activate: (request: {
      params: { readonly paymentProviderId: string; readonly mappingId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsActivate(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["mappingId"],
        ),
      ),
    create: (request: {
      params: { readonly paymentProviderId: string };
      payload: Parameters<VoidhashCoreClient["paymentProviderProductsCreate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsCreate(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.payload,
        ),
      ),
    delete: (request: {
      params: { readonly paymentProviderId: string; readonly mappingId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsDelete(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["mappingId"],
        ),
      ),
    explainMove: (request: {
      params: { readonly paymentProviderId: string; readonly mappingId: string };
      payload: Parameters<VoidhashCoreClient["paymentProviderProductsExplainMove"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsExplainMove(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["mappingId"],
          request.payload,
        ),
      ),
    get: (request: {
      params: { readonly paymentProviderId: string; readonly mappingId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsGet(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["mappingId"],
        ),
      ),
    list: (request: {
      params: {
        readonly paymentProviderId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly productId?: string;
        readonly providerProductKey?: string;
        readonly isActive?: "true" | "false";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsList(resolvedProjectId, request.params["paymentProviderId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          productId: request.params["productId"],
          providerProductKey: request.params["providerProductKey"],
          isActive: request.params["isActive"],
        }),
      ),
    move: (request: {
      params: { readonly paymentProviderId: string; readonly mappingId: string };
      payload: Parameters<VoidhashCoreClient["paymentProviderProductsMove"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsMove(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["mappingId"],
          request.payload,
        ),
      ),
    sell: (request: {
      params: { readonly paymentProviderId: string; readonly mappingId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsSell(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["mappingId"],
        ),
      ),
    update: (request: {
      params: { readonly paymentProviderId: string; readonly mappingId: string };
      payload: Parameters<VoidhashCoreClient["paymentProviderProductsUpdate"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProviderProductsUpdate(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["mappingId"],
          request.payload,
        ),
      ),
  },
  paymentProviders: {
    create: (request: { payload: Parameters<VoidhashCoreClient["paymentProvidersCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly paymentProviderId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersDelete(resolvedProjectId, request.params["paymentProviderId"]),
      ),
    get: (request: { params: { readonly paymentProviderId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersGet(resolvedProjectId, request.params["paymentProviderId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly type?: "app_store" | "google_play" | "stripe" | "payment_source";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          type: request?.params?.["type"],
        }),
      ),
    listCatalog: (request: {
      params: {
        readonly paymentProviderId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly isUnmapped?: "true" | "false";
        readonly refresh?: "true" | "false";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersListCatalog(resolvedProjectId, request.params["paymentProviderId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          isUnmapped: request.params["isUnmapped"],
          refresh: request.params["refresh"],
        }),
      ),
    listUnmappedProducts: (request: {
      params: {
        readonly paymentProviderId: string;
        readonly cursor?: string;
        readonly limit?: number;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersListUnmappedProducts(
          resolvedProjectId,
          request.params["paymentProviderId"],
          { cursor: request.params["cursor"], limit: request.params["limit"] },
        ),
      ),
    test: (request: {
      params: { readonly paymentProviderId: string; readonly environment?: "production" | "test" };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersTest(resolvedProjectId, request.params["paymentProviderId"], {
          environment: request.params["environment"],
        }),
      ),
    update: (request: {
      params: { readonly paymentProviderId: string };
      payload: Parameters<VoidhashCoreClient["paymentProvidersUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentProvidersUpdate(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.payload,
        ),
      ),
  },
  paymentSources: {
    cancelSubscription: (request: {
      params: { readonly paymentProviderId: string; readonly externalId: string };
      payload: Parameters<VoidhashCoreClient["paymentSourcesCancelSubscription"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentSourcesCancelSubscription(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["externalId"],
          request.payload,
        ),
      ),
    refundTransaction: (request: {
      params: { readonly paymentProviderId: string; readonly externalId: string };
      payload: Parameters<VoidhashCoreClient["paymentSourcesRefundTransaction"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentSourcesRefundTransaction(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["externalId"],
          request.payload,
        ),
      ),
    upsertSubscription: (request: {
      params: { readonly paymentProviderId: string; readonly externalId: string };
      payload: Parameters<VoidhashCoreClient["paymentSourcesUpsertSubscription"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentSourcesUpsertSubscription(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["externalId"],
          request.payload,
        ),
      ),
    upsertTransaction: (request: {
      params: { readonly paymentProviderId: string; readonly externalId: string };
      payload: Parameters<VoidhashCoreClient["paymentSourcesUpsertTransaction"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paymentSourcesUpsertTransaction(
          resolvedProjectId,
          request.params["paymentProviderId"],
          request.params["externalId"],
          request.payload,
        ),
      ),
  },
  paywallLocations: {
    archive: (request: { params: { readonly paywallLocationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsArchive(resolvedProjectId, request.params["paywallLocationId"]),
      ),
    clearShowing: (request: {
      params: { readonly paywallLocationId: string; readonly environment?: "production" | "test" };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsClearShowing(
          resolvedProjectId,
          request.params["paywallLocationId"],
          { environment: request.params["environment"] },
        ),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["paywallLocationsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsCreate(resolvedProjectId, request.payload),
      ),
    get: (request: { params: { readonly paywallLocationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsGet(resolvedProjectId, request.params["paywallLocationId"]),
      ),
    getDefaultAnswer: (request: {
      params: { readonly paywallLocationId: string; readonly interfaceRevision?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsGetDefaultAnswer(
          resolvedProjectId,
          request.params["paywallLocationId"],
          { interfaceRevision: request.params["interfaceRevision"] },
        ),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly isArchived?: "true" | "false";
        readonly slug?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          isArchived: request?.params?.["isArchived"],
          slug: request?.params?.["slug"],
        }),
      ),
    listPins: (request: {
      params: {
        readonly paywallLocationId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly environment?: "production" | "test";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsListPins(resolvedProjectId, request.params["paywallLocationId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          environment: request.params["environment"],
        }),
      ),
    listRules: (request: {
      params: {
        readonly paywallLocationId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly environment?: "production" | "test";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsListRules(resolvedProjectId, request.params["paywallLocationId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          environment: request.params["environment"],
        }),
      ),
    listShowings: (request: {
      params: {
        readonly paywallLocationId: string;
        readonly cursor?: string;
        readonly limit?: number;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsListShowings(
          resolvedProjectId,
          request.params["paywallLocationId"],
          { cursor: request.params["cursor"], limit: request.params["limit"] },
        ),
      ),
    removePin: (request: {
      params: {
        readonly paywallLocationId: string;
        readonly identity: string;
        readonly environment?: "production" | "test";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsRemovePin(
          resolvedProjectId,
          request.params["paywallLocationId"],
          request.params["identity"],
          { environment: request.params["environment"] },
        ),
      ),
    replaceRules: (request: {
      params: { readonly paywallLocationId: string; readonly environment?: "production" | "test" };
      payload: Parameters<VoidhashCoreClient["paywallLocationsReplaceRules"]>[2]["payload"];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsReplaceRules(
          resolvedProjectId,
          request.params["paywallLocationId"],
          { params: { environment: request.params["environment"] }, payload: request.payload },
        ),
      ),
    setInterface: (request: {
      params: { readonly paywallLocationId: string };
      payload: Parameters<VoidhashCoreClient["paywallLocationsSetInterface"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsSetInterface(
          resolvedProjectId,
          request.params["paywallLocationId"],
          request.payload,
        ),
      ),
    setShowing: (request: {
      params: { readonly paywallLocationId: string; readonly environment?: "production" | "test" };
      payload: Parameters<VoidhashCoreClient["paywallLocationsSetShowing"]>[2]["payload"];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsSetShowing(resolvedProjectId, request.params["paywallLocationId"], {
          params: { environment: request.params["environment"] },
          payload: request.payload,
        }),
      ),
    update: (request: {
      params: { readonly paywallLocationId: string };
      payload: Parameters<VoidhashCoreClient["paywallLocationsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsUpdate(
          resolvedProjectId,
          request.params["paywallLocationId"],
          request.payload,
        ),
      ),
    upsertPin: (request: {
      params: {
        readonly paywallLocationId: string;
        readonly identity: string;
        readonly environment?: "production" | "test";
      };
      payload: Parameters<VoidhashCoreClient["paywallLocationsUpsertPin"]>[3]["payload"];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallLocationsUpsertPin(
          resolvedProjectId,
          request.params["paywallLocationId"],
          request.params["identity"],
          { params: { environment: request.params["environment"] }, payload: request.payload },
        ),
      ),
  },
  paywalls: {
    addLocation: (request: {
      params: { readonly paywallId: string; readonly paywallLocationId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsAddLocation(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["paywallLocationId"],
        ),
      ),
    archive: (request: { params: { readonly paywallId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsArchive(resolvedProjectId, request.params["paywallId"]),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["paywallsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsCreate(resolvedProjectId, request.payload),
      ),
    createBuild: (request: {
      params: { readonly paywallId: string };
      payload: Parameters<VoidhashCoreClient["paywallsCreateBuild"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsCreateBuild(resolvedProjectId, request.params["paywallId"], request.payload),
      ),
    delete: (request: { params: { readonly paywallId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsDelete(resolvedProjectId, request.params["paywallId"]),
      ),
    deployBuild: (request: { params: { readonly paywallId: string; readonly buildId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsDeployBuild(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["buildId"],
        ),
      ),
    duplicate: (request: {
      params: { readonly paywallId: string };
      payload: Parameters<VoidhashCoreClient["paywallsDuplicate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsDuplicate(resolvedProjectId, request.params["paywallId"], request.payload),
      ),
    get: (request: { params: { readonly paywallId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsGet(resolvedProjectId, request.params["paywallId"]),
      ),
    getBuild: (request: { params: { readonly paywallId: string; readonly buildId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsGetBuild(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["buildId"],
        ),
      ),
    getBuildWithdrawal: (request: {
      params: { readonly paywallId: string; readonly buildId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsGetBuildWithdrawal(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["buildId"],
        ),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly isArchived?: "true" | "false";
        readonly slug?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          isArchived: request?.params?.["isArchived"],
          slug: request?.params?.["slug"],
        }),
      ),
    listBuilds: (request: {
      params: {
        readonly paywallId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly isWithdrawn?: "true" | "false";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsListBuilds(resolvedProjectId, request.params["paywallId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          isWithdrawn: request.params["isWithdrawn"],
        }),
      ),
    listLocations: (request: {
      params: { readonly paywallId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsListLocations(resolvedProjectId, request.params["paywallId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    listUses: (request: {
      params: { readonly paywallId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsListUses(resolvedProjectId, request.params["paywallId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    removeLocation: (request: {
      params: { readonly paywallId: string; readonly paywallLocationId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsRemoveLocation(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["paywallLocationId"],
        ),
      ),
    restoreBuild: (request: { params: { readonly paywallId: string; readonly buildId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsRestoreBuild(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["buildId"],
        ),
      ),
    setEnvironment: (request: {
      params: { readonly paywallId: string; readonly environment: "production" | "test" };
      payload: Parameters<VoidhashCoreClient["paywallsSetEnvironment"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsSetEnvironment(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["environment"],
          request.payload,
        ),
      ),
    unarchive: (request: { params: { readonly paywallId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsUnarchive(resolvedProjectId, request.params["paywallId"]),
      ),
    update: (request: {
      params: { readonly paywallId: string };
      payload: Parameters<VoidhashCoreClient["paywallsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsUpdate(resolvedProjectId, request.params["paywallId"], request.payload),
      ),
    withdrawBuild: (request: {
      params: { readonly paywallId: string; readonly buildId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallsWithdrawBuild(
          resolvedProjectId,
          request.params["paywallId"],
          request.params["buildId"],
        ),
      ),
  },
  paywallTemplates: {
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly kind?: "paywall" | "onboarding" | "feedback" | "reactivation" | "custom";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.paywallTemplatesList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          kind: request?.params?.["kind"],
        }),
      ),
  },
  perks: {
    create: (request: { payload: Parameters<VoidhashCoreClient["perksCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.perksCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly perkId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.perksDelete(resolvedProjectId, request.params["perkId"]),
      ),
    get: (request: { params: { readonly perkId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.perksGet(resolvedProjectId, request.params["perkId"]),
      ),
    list: (request?: {
      params?: { readonly cursor?: string; readonly limit?: number; readonly slug?: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.perksList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          slug: request?.params?.["slug"],
        }),
      ),
    update: (request: {
      params: { readonly perkId: string };
      payload: Parameters<VoidhashCoreClient["perksUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.perksUpdate(resolvedProjectId, request.params["perkId"], request.payload),
      ),
  },
  persons: {
    create: (request: { payload: Parameters<VoidhashCoreClient["personsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsCreate(resolvedProjectId, request.payload),
      ),
    createErasure: (request: {
      payload: Parameters<VoidhashCoreClient["personsCreateErasure"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsCreateErasure(resolvedProjectId, request.payload),
      ),
    createGrant: (request: {
      params: { readonly personId: string; readonly "idempotency-key"?: string };
      payload: Parameters<VoidhashCoreClient["personsCreateGrant"]>[2]["payload"];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsCreateGrant(resolvedProjectId, request.params["personId"], {
          params: { "idempotency-key": request.params["idempotency-key"] },
          payload: request.payload,
        }),
      ),
    get: (request: { params: { readonly personId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsGet(resolvedProjectId, request.params["personId"]),
      ),
    getErasure: (request: { params: { readonly erasureId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsGetErasure(resolvedProjectId, request.params["erasureId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly distinctId?: string;
        readonly email?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          distinctId: request?.params?.["distinctId"],
          email: request?.params?.["email"],
        }),
      ),
    listEntitlements: (request: {
      params: { readonly personId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsListEntitlements(resolvedProjectId, request.params["personId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    listGrants: (request: {
      params: { readonly personId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsListGrants(resolvedProjectId, request.params["personId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    listPurchases: (request: {
      params: { readonly personId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsListPurchases(resolvedProjectId, request.params["personId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    listSubscriptions: (request: {
      params: { readonly personId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsListSubscriptions(resolvedProjectId, request.params["personId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    revokeGrant: (request: { params: { readonly personId: string; readonly grantId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsRevokeGrant(
          resolvedProjectId,
          request.params["personId"],
          request.params["grantId"],
        ),
      ),
    update: (request: {
      params: { readonly personId: string };
      payload: Parameters<VoidhashCoreClient["personsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.personsUpdate(resolvedProjectId, request.params["personId"], request.payload),
      ),
  },
  products: {
    addPerk: (request: { params: { readonly productId: string; readonly perkId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsAddPerk(
          resolvedProjectId,
          request.params["productId"],
          request.params["perkId"],
        ),
      ),
    create: (request: { payload: Parameters<VoidhashCoreClient["productsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly productId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsDelete(resolvedProjectId, request.params["productId"]),
      ),
    get: (request: { params: { readonly productId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsGet(resolvedProjectId, request.params["productId"]),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly type?: "subscription" | "one_time" | "one_time_consumable";
        readonly slug?: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          type: request?.params?.["type"],
          slug: request?.params?.["slug"],
        }),
      ),
    listPerks: (request: {
      params: { readonly productId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsListPerks(resolvedProjectId, request.params["productId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    removePerk: (request: { params: { readonly productId: string; readonly perkId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsRemovePerk(
          resolvedProjectId,
          request.params["productId"],
          request.params["perkId"],
        ),
      ),
    update: (request: {
      params: { readonly productId: string };
      payload: Parameters<VoidhashCoreClient["productsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.productsUpdate(resolvedProjectId, request.params["productId"], request.payload),
      ),
  },
  projects: {
    create: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["projectsCreate"]>[1];
    }) => client.projectsCreate(request.params["organizationId"], request.payload),
    delete: () =>
      Effect.flatMap(projectId, (resolvedProjectId) => client.projectsDelete(resolvedProjectId)),
    get: () =>
      Effect.flatMap(projectId, (resolvedProjectId) => client.projectsGet(resolvedProjectId)),
    getSettings: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.projectsGetSettings(resolvedProjectId),
      ),
    list: (request: {
      params: {
        readonly organizationId: string;
        readonly cursor?: string;
        readonly limit?: number;
      };
    }) =>
      client.projectsList(request.params["organizationId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
      }),
    removeAvatar: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.projectsRemoveAvatar(resolvedProjectId),
      ),
    setAvatar: (request: { payload: Parameters<VoidhashCoreClient["projectsSetAvatar"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.projectsSetAvatar(resolvedProjectId, request.payload),
      ),
    update: (request: { payload: Parameters<VoidhashCoreClient["projectsUpdate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.projectsUpdate(resolvedProjectId, request.payload),
      ),
    updateSettings: (request: {
      payload: Parameters<VoidhashCoreClient["projectsUpdateSettings"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.projectsUpdateSettings(resolvedProjectId, request.payload),
      ),
  },
  pushNotificationConfigurations: {
    create: (request: {
      payload: Parameters<VoidhashCoreClient["pushNotificationConfigurationsCreate"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationConfigurationsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly configurationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationConfigurationsDelete(
          resolvedProjectId,
          request.params["configurationId"],
        ),
      ),
    get: (request: { params: { readonly configurationId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationConfigurationsGet(
          resolvedProjectId,
          request.params["configurationId"],
        ),
      ),
    list: (request?: {
      params?: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly type?: "fcm" | "apns";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationConfigurationsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
          type: request?.params?.["type"],
        }),
      ),
    update: (request: {
      params: { readonly configurationId: string };
      payload: Parameters<VoidhashCoreClient["pushNotificationConfigurationsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationConfigurationsUpdate(
          resolvedProjectId,
          request.params["configurationId"],
          request.payload,
        ),
      ),
  },
  pushNotifications: {
    create: (request: {
      params?: { readonly "idempotency-key"?: string };
      payload: Parameters<VoidhashCoreClient["pushNotificationsCreate"]>[1]["payload"];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationsCreate(resolvedProjectId, {
          params: { "idempotency-key": request.params?.["idempotency-key"] },
          payload: request.payload,
        }),
      ),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    listDeliveries: (request: {
      params: {
        readonly pushNotificationId: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly status?: "pending" | "in_progress" | "succeeded" | "failed" | "exhausted";
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.pushNotificationsListDeliveries(
          resolvedProjectId,
          request.params["pushNotificationId"],
          {
            cursor: request.params["cursor"],
            limit: request.params["limit"],
            status: request.params["status"],
          },
        ),
      ),
  },
  reports: {
    createInsight: (request: {
      params: { readonly reportId: string };
      payload: Parameters<VoidhashCoreClient["reportsCreateInsight"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.reportsCreateInsight(resolvedProjectId, request.params["reportId"], request.payload),
      ),
    deleteInsight: (request: {
      params: { readonly reportId: string; readonly insightId: string };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.reportsDeleteInsight(
          resolvedProjectId,
          request.params["reportId"],
          request.params["insightId"],
        ),
      ),
    get: (request: { params: { readonly reportId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.reportsGet(resolvedProjectId, request.params["reportId"]),
      ),
    update: (request: {
      params: { readonly reportId: string };
      payload: Parameters<VoidhashCoreClient["reportsUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.reportsUpdate(resolvedProjectId, request.params["reportId"], request.payload),
      ),
    updateInsight: (request: {
      params: { readonly reportId: string; readonly insightId: string };
      payload: Parameters<VoidhashCoreClient["reportsUpdateInsight"]>[3];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.reportsUpdateInsight(
          resolvedProjectId,
          request.params["reportId"],
          request.params["insightId"],
          request.payload,
        ),
      ),
  },
  sandbox: {
    createAction: (request: {
      payload: Parameters<VoidhashCoreClient["sandboxCreateAction"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.sandboxCreateAction(resolvedProjectId, request.payload),
      ),
    deleteData: () =>
      Effect.flatMap(projectId, (resolvedProjectId) => client.sandboxDeleteData(resolvedProjectId)),
    getSettings: () =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.sandboxGetSettings(resolvedProjectId),
      ),
    getState: (request: { params: { readonly personId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.sandboxGetState(resolvedProjectId, { personId: request.params["personId"] }),
      ),
    updateSettings: (request: {
      payload: Parameters<VoidhashCoreClient["sandboxUpdateSettings"]>[1];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.sandboxUpdateSettings(resolvedProjectId, request.payload),
      ),
  },
  schema: {
    get: (request?: { params?: { readonly "if-none-match"?: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.schemaGet(resolvedProjectId, {
          "if-none-match": request?.params?.["if-none-match"],
        }),
      ),
    getVersion: (request?: { params?: { readonly "if-none-match"?: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.schemaGetVersion(resolvedProjectId, {
          "if-none-match": request?.params?.["if-none-match"],
        }),
      ),
  },
  session: {
    delete: () => client.sessionDelete(),
    get: () => client.sessionGet(),
  },
  subscriptions: {
    add: (request: { params: { readonly subjectType: string; readonly subjectId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.subscriptionsAdd(
          resolvedProjectId,
          request.params["subjectType"],
          request.params["subjectId"],
        ),
      ),
    list: (request: {
      params: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly subjectType: string;
        readonly subjectId: string;
      };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.subscriptionsList(resolvedProjectId, {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
          subjectType: request.params["subjectType"],
          subjectId: request.params["subjectId"],
        }),
      ),
    remove: (request: { params: { readonly subjectType: string; readonly subjectId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.subscriptionsRemove(
          resolvedProjectId,
          request.params["subjectType"],
          request.params["subjectId"],
        ),
      ),
  },
  trackingDomains: {
    create: (request: { payload: Parameters<VoidhashCoreClient["trackingDomainsCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.trackingDomainsCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly trackingDomainId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.trackingDomainsDelete(resolvedProjectId, request.params["trackingDomainId"]),
      ),
    get: (request: { params: { readonly trackingDomainId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.trackingDomainsGet(resolvedProjectId, request.params["trackingDomainId"]),
      ),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.trackingDomainsList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    verify: (request: { params: { readonly trackingDomainId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.trackingDomainsVerify(resolvedProjectId, request.params["trackingDomainId"]),
      ),
  },
  voidql: {
    explain: (request: { payload: Parameters<VoidhashCoreClient["voidqlExplain"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.voidqlExplain(resolvedProjectId, request.payload),
      ),
    getSchema: () =>
      Effect.flatMap(projectId, (resolvedProjectId) => client.voidqlGetSchema(resolvedProjectId)),
    query: (request: { payload: Parameters<VoidhashCoreClient["voidqlQuery"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.voidqlQuery(resolvedProjectId, request.payload),
      ),
  },
  webhooks: {
    create: (request: { payload: Parameters<VoidhashCoreClient["webhooksCreate"]>[1] }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksCreate(resolvedProjectId, request.payload),
      ),
    delete: (request: { params: { readonly webhookId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksDelete(resolvedProjectId, request.params["webhookId"]),
      ),
    get: (request: { params: { readonly webhookId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksGet(resolvedProjectId, request.params["webhookId"]),
      ),
    getDelivery: (request: { params: { readonly deliveryId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksGetDelivery(resolvedProjectId, request.params["deliveryId"]),
      ),
    list: (request?: { params?: { readonly cursor?: string; readonly limit?: number } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksList(resolvedProjectId, {
          cursor: request?.params?.["cursor"],
          limit: request?.params?.["limit"],
        }),
      ),
    listDeliveries: (request: {
      params: { readonly webhookId: string; readonly cursor?: string; readonly limit?: number };
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksListDeliveries(resolvedProjectId, request.params["webhookId"], {
          cursor: request.params["cursor"],
          limit: request.params["limit"],
        }),
      ),
    retryDelivery: (request: { params: { readonly deliveryId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksRetryDelivery(resolvedProjectId, request.params["deliveryId"]),
      ),
    rotate: (request: { params: { readonly webhookId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksRotate(resolvedProjectId, request.params["webhookId"]),
      ),
    test: (request: { params: { readonly webhookId: string } }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksTest(resolvedProjectId, request.params["webhookId"]),
      ),
    update: (request: {
      params: { readonly webhookId: string };
      payload: Parameters<VoidhashCoreClient["webhooksUpdate"]>[2];
    }) =>
      Effect.flatMap(projectId, (resolvedProjectId) =>
        client.webhooksUpdate(resolvedProjectId, request.params["webhookId"], request.payload),
      ),
  },
});

export type GroupedVoidhashNodeEffectClient<ProjectIdError> = ReturnType<
  typeof groupCoreClient<ProjectIdError>
>;
