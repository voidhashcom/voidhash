import type { VoidhashCoreClient } from "@voidhash/generated-clients";

export const groupCoreClient = (client: VoidhashCoreClient) => ({
  analytics: {
    queryInsights: (request: {
      payload: Parameters<VoidhashCoreClient["analyticsQueryInsights"]>[0];
    }) => client.analyticsQueryInsights(request.payload),
  },
  apiKeys: {
    createSecretKey: (request: {
      payload: Parameters<VoidhashCoreClient["apiKeysCreateSecretKey"]>[0];
    }) => client.apiKeysCreateSecretKey(request.payload),
    deleteApiKey: (request: { params: { readonly apiKeyId: string } }) =>
      client.apiKeysDeleteApiKey(request.params["apiKeyId"]),
    getApiKeyById: (request: { params: { readonly apiKeyId: string } }) =>
      client.apiKeysGetApiKeyById(request.params["apiKeyId"]),
    listApiKeys: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.apiKeysListApiKeys({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
      }),
    rotateSecretKey: (request: { params: { readonly apiKeyId: string } }) =>
      client.apiKeysRotateSecretKey(request.params["apiKeyId"]),
  },
  auth: {
    session: () => client.authSession(),
  },
  development: {
    applyDevelopmentLifecycleAction: (request: {
      payload: Parameters<VoidhashCoreClient["developmentApplyDevelopmentLifecycleAction"]>[0];
    }) => client.developmentApplyDevelopmentLifecycleAction(request.payload),
    getDevelopmentSettings: (request: { params: { readonly projectId?: string | null } }) =>
      client.developmentGetDevelopmentSettings({ projectId: request.params["projectId"] }),
    getDevelopmentState: (request: {
      params: { readonly personId: string; readonly projectId?: string | null };
    }) =>
      client.developmentGetDevelopmentState({
        personId: request.params["personId"],
        projectId: request.params["projectId"],
      }),
    resetDevelopmentData: (request: { params: { readonly projectId?: string | null } }) =>
      client.developmentResetDevelopmentData({ projectId: request.params["projectId"] }),
    updateDevelopmentSettings: (request: {
      payload: Parameters<VoidhashCoreClient["developmentUpdateDevelopmentSettings"]>[0];
    }) => client.developmentUpdateDevelopmentSettings(request.payload),
  },
  events: {
    listEvents: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly eventName?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.eventsListEvents({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        eventName: request.params["eventName"],
        projectId: request.params["projectId"],
      }),
  },
  experiments: {
    archiveExperiment: (request: { params: { readonly experimentId: string } }) =>
      client.experimentsArchiveExperiment(request.params["experimentId"]),
    concludeExperiment: (request: {
      params: { readonly experimentId: string };
      payload: Parameters<VoidhashCoreClient["experimentsConcludeExperiment"]>[1];
    }) => client.experimentsConcludeExperiment(request.params["experimentId"], request.payload),
    createExperiment: (request: {
      payload: Parameters<VoidhashCoreClient["experimentsCreateExperiment"]>[0];
    }) => client.experimentsCreateExperiment(request.payload),
    getExperiment: (request: { params: { readonly experimentId: string } }) =>
      client.experimentsGetExperiment(request.params["experimentId"]),
    getExperimentResults: (request: {
      params: { readonly experimentId: string; readonly days?: string | null };
    }) =>
      client.experimentsGetExperimentResults(request.params["experimentId"], {
        days: request.params["days"],
      }),
    listExperiments: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly includeArchived?: "true" | "false" | null;
        readonly projectId?: string | null;
        readonly status?: "draft" | "running" | "paused" | "concluded" | null;
      };
    }) =>
      client.experimentsListExperiments({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        includeArchived: request.params["includeArchived"],
        projectId: request.params["projectId"],
        status: request.params["status"],
      }),
    pauseExperiment: (request: { params: { readonly experimentId: string } }) =>
      client.experimentsPauseExperiment(request.params["experimentId"]),
    restoreExperiment: (request: { params: { readonly experimentId: string } }) =>
      client.experimentsRestoreExperiment(request.params["experimentId"]),
    startExperiment: (request: { params: { readonly experimentId: string } }) =>
      client.experimentsStartExperiment(request.params["experimentId"]),
    updateExperiment: (request: {
      params: { readonly experimentId: string };
      payload: Parameters<VoidhashCoreClient["experimentsUpdateExperiment"]>[1];
    }) => client.experimentsUpdateExperiment(request.params["experimentId"], request.payload),
  },
  featureFlagOverrides: {
    archiveFeatureFlagOverride: (request: { params: { readonly overrideId: string } }) =>
      client.featureFlagOverridesArchiveFeatureFlagOverride(request.params["overrideId"]),
    listFeatureFlagOverrides: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly featureFlagId?: string | null;
        readonly identityType?: string | null;
        readonly identityValue?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.featureFlagOverridesListFeatureFlagOverrides({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        featureFlagId: request.params["featureFlagId"],
        identityType: request.params["identityType"],
        identityValue: request.params["identityValue"],
        projectId: request.params["projectId"],
      }),
    upsertFeatureFlagOverride: (request: {
      payload: Parameters<VoidhashCoreClient["featureFlagOverridesUpsertFeatureFlagOverride"]>[0];
    }) => client.featureFlagOverridesUpsertFeatureFlagOverride(request.payload),
  },
  featureFlags: {
    archiveFeatureFlag: (request: { params: { readonly featureFlagId: string } }) =>
      client.featureFlagsArchiveFeatureFlag(request.params["featureFlagId"]),
    createFeatureFlag: (request: {
      payload: Parameters<VoidhashCoreClient["featureFlagsCreateFeatureFlag"]>[0];
    }) => client.featureFlagsCreateFeatureFlag(request.payload),
    evaluateProjectFeatureFlags: (request: {
      payload: Parameters<VoidhashCoreClient["featureFlagsEvaluateProjectFeatureFlags"]>[0];
    }) => client.featureFlagsEvaluateProjectFeatureFlags(request.payload),
    getFeatureFlag: (request: { params: { readonly featureFlagId: string } }) =>
      client.featureFlagsGetFeatureFlag(request.params["featureFlagId"]),
    listFeatureFlags: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly includeArchived?: "true" | "false" | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.featureFlagsListFeatureFlags({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        includeArchived: request.params["includeArchived"],
        projectId: request.params["projectId"],
      }),
    replaceFeatureFlagVariants: (request: {
      params: { readonly featureFlagId: string };
      payload: Parameters<VoidhashCoreClient["featureFlagsReplaceFeatureFlagVariants"]>[1];
    }) =>
      client.featureFlagsReplaceFeatureFlagVariants(
        request.params["featureFlagId"],
        request.payload,
      ),
    restoreFeatureFlag: (request: { params: { readonly featureFlagId: string } }) =>
      client.featureFlagsRestoreFeatureFlag(request.params["featureFlagId"]),
    updateFeatureFlag: (request: {
      params: { readonly featureFlagId: string };
      payload: Parameters<VoidhashCoreClient["featureFlagsUpdateFeatureFlag"]>[1];
    }) => client.featureFlagsUpdateFeatureFlag(request.params["featureFlagId"], request.payload),
  },
  featureFlagTargets: {
    archiveFeatureFlagTarget: (request: { params: { readonly targetId: string } }) =>
      client.featureFlagTargetsArchiveFeatureFlagTarget(request.params["targetId"]),
    listFeatureFlagTargets: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly featureFlagId: string;
        readonly listType?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.featureFlagTargetsListFeatureFlagTargets({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        featureFlagId: request.params["featureFlagId"],
        listType: request.params["listType"],
        projectId: request.params["projectId"],
      }),
    upsertFeatureFlagTarget: (request: {
      payload: Parameters<VoidhashCoreClient["featureFlagTargetsUpsertFeatureFlagTarget"]>[0];
    }) => client.featureFlagTargetsUpsertFeatureFlagTarget(request.payload),
  },
  ingestPolicy: {
    getIngestPolicy: (request: { params: { readonly projectId?: string | null } }) =>
      client.ingestPolicyGetIngestPolicy({ projectId: request.params["projectId"] }),
    setBuiltinEventAdmission: (request: {
      params: { readonly key: string };
      payload: Parameters<VoidhashCoreClient["ingestPolicySetBuiltinEventAdmission"]>[1];
    }) => client.ingestPolicySetBuiltinEventAdmission(request.params["key"], request.payload),
    setCustomEventBlocked: (request: {
      params: { readonly eventName: string };
      payload: Parameters<VoidhashCoreClient["ingestPolicySetCustomEventBlocked"]>[1];
    }) => client.ingestPolicySetCustomEventBlocked(request.params["eventName"], request.payload),
  },
  notifications: {
    createNotification: (request: {
      payload: Parameters<VoidhashCoreClient["notificationsCreateNotification"]>[0];
    }) => client.notificationsCreateNotification(request.payload),
  },
  notificationSends: {
    listNotificationSendDeliveries: (request: {
      params: {
        readonly sendId: string;
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
        readonly status?: string | null;
      };
    }) =>
      client.notificationSendsListNotificationSendDeliveries(request.params["sendId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
        status: request.params["status"],
      }),
    listNotificationSends: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.notificationSendsListNotificationSends({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
      }),
  },
  organizations: {
    createOrganization: (request: {
      payload: Parameters<VoidhashCoreClient["organizationsCreateOrganization"]>[0];
    }) => client.organizationsCreateOrganization(request.payload),
    getOrganization: (request: { params: { readonly organizationId: string } }) =>
      client.organizationsGetOrganization(request.params["organizationId"]),
    listOrganizationProjects: (request: {
      params: {
        readonly organizationId: string;
        readonly cursor?: string | null;
        readonly limit?: string | null;
      };
    }) =>
      client.organizationsListOrganizationProjects(request.params["organizationId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
      }),
    listOrganizations: (request: {
      params: { readonly cursor?: string | null; readonly limit?: string | null };
    }) =>
      client.organizationsListOrganizations({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
      }),
    updateOrganization: (request: {
      params: { readonly organizationId: string };
      payload: Parameters<VoidhashCoreClient["organizationsUpdateOrganization"]>[1];
    }) => client.organizationsUpdateOrganization(request.params["organizationId"], request.payload),
  },
  paymentProviderConfigurations: {
    createPaymentProviderConfiguration: (request: {
      payload: Parameters<
        VoidhashCoreClient["paymentProviderConfigurationsCreatePaymentProviderConfiguration"]
      >[0];
    }) => client.paymentProviderConfigurationsCreatePaymentProviderConfiguration(request.payload),
    deletePaymentProviderConfiguration: (request: {
      params: { readonly configurationId: string };
    }) =>
      client.paymentProviderConfigurationsDeletePaymentProviderConfiguration(
        request.params["configurationId"],
      ),
    getPaymentProviderConfiguration: (request: { params: { readonly configurationId: string } }) =>
      client.paymentProviderConfigurationsGetPaymentProviderConfiguration(
        request.params["configurationId"],
      ),
    listPaymentProviderConfigurations: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
        readonly providerId?: string | null;
      };
    }) =>
      client.paymentProviderConfigurationsListPaymentProviderConfigurations({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
        providerId: request.params["providerId"],
      }),
    updatePaymentProviderConfiguration: (request: {
      params: { readonly configurationId: string };
      payload: Parameters<
        VoidhashCoreClient["paymentProviderConfigurationsUpdatePaymentProviderConfiguration"]
      >[1];
    }) =>
      client.paymentProviderConfigurationsUpdatePaymentProviderConfiguration(
        request.params["configurationId"],
        request.payload,
      ),
  },
  paymentProviderProducts: {
    activatePaymentProviderProduct: (request: { params: { readonly mappingId: string } }) =>
      client.paymentProviderProductsActivatePaymentProviderProduct(request.params["mappingId"]),
    createPaymentProviderProduct: (request: {
      payload: Parameters<
        VoidhashCoreClient["paymentProviderProductsCreatePaymentProviderProduct"]
      >[0];
    }) => client.paymentProviderProductsCreatePaymentProviderProduct(request.payload),
    deletePaymentProviderProduct: (request: { params: { readonly mappingId: string } }) =>
      client.paymentProviderProductsDeletePaymentProviderProduct(request.params["mappingId"]),
    getPaymentProviderProduct: (request: { params: { readonly mappingId: string } }) =>
      client.paymentProviderProductsGetPaymentProviderProduct(request.params["mappingId"]),
    listPaymentProviderProducts: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly paymentProviderConfigurationId?: string | null;
        readonly productId?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.paymentProviderProductsListPaymentProviderProducts({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        paymentProviderConfigurationId: request.params["paymentProviderConfigurationId"],
        productId: request.params["productId"],
        projectId: request.params["projectId"],
      }),
    updatePaymentProviderProduct: (request: {
      params: { readonly mappingId: string };
      payload: Parameters<
        VoidhashCoreClient["paymentProviderProductsUpdatePaymentProviderProduct"]
      >[1];
    }) =>
      client.paymentProviderProductsUpdatePaymentProviderProduct(
        request.params["mappingId"],
        request.payload,
      ),
  },
  paywallDeploys: {
    createDeploy: (request: {
      payload: Parameters<VoidhashCoreClient["paywallDeploysCreateDeploy"]>[0];
    }) => client.paywallDeploysCreateDeploy(request.payload),
    finalizeDeploy: (request: { params: { readonly deployId: string } }) =>
      client.paywallDeploysFinalizeDeploy(request.params["deployId"]),
    getDeploy: (request: {
      params: { readonly deployId: string; readonly projectId?: string | null };
    }) =>
      client.paywallDeploysGetDeploy(request.params["deployId"], {
        projectId: request.params["projectId"],
      }),
    listDeploys: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
        readonly status?: "pending" | "ready" | null;
      };
    }) =>
      client.paywallDeploysListDeploys({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
        status: request.params["status"],
      }),
    uploadBlob: (request: { params: { readonly deployId: string; readonly sha256: string } }) =>
      client.paywallDeploysUploadBlob(request.params["deployId"], request.params["sha256"]),
  },
  paywallLocations: {
    archivePaywallLocation: (request: { params: { readonly locationId: string } }) =>
      client.paywallLocationsArchivePaywallLocation(request.params["locationId"]),
    clearPaywallLocationShowing: (request: { params: { readonly locationId: string } }) =>
      client.paywallLocationsClearPaywallLocationShowing(request.params["locationId"]),
    createPaywallLocation: (request: {
      payload: Parameters<VoidhashCoreClient["paywallLocationsCreatePaywallLocation"]>[0];
    }) => client.paywallLocationsCreatePaywallLocation(request.payload),
    getPaywallLocation: (request: {
      params: { readonly locationId: string; readonly projectId?: string | null };
    }) =>
      client.paywallLocationsGetPaywallLocation(request.params["locationId"], {
        projectId: request.params["projectId"],
      }),
    listPaywallLocations: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly includeArchived?: "true" | "false" | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.paywallLocationsListPaywallLocations({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        includeArchived: request.params["includeArchived"],
        projectId: request.params["projectId"],
      }),
    listPaywallLocationShowings: (request: {
      params: {
        readonly locationId: string;
        readonly cursor?: string | null;
        readonly limit?: string | null;
      };
    }) =>
      client.paywallLocationsListPaywallLocationShowings(request.params["locationId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
      }),
    setPaywallLocationShowing: (request: {
      params: { readonly locationId: string };
      payload: Parameters<VoidhashCoreClient["paywallLocationsSetPaywallLocationShowing"]>[1];
    }) =>
      client.paywallLocationsSetPaywallLocationShowing(
        request.params["locationId"],
        request.payload,
      ),
    updatePaywallLocation: (request: {
      params: { readonly locationId: string };
      payload: Parameters<VoidhashCoreClient["paywallLocationsUpdatePaywallLocation"]>[1];
    }) =>
      client.paywallLocationsUpdatePaywallLocation(request.params["locationId"], request.payload),
  },
  paywalls: {
    activatePaywallRelease: (request: {
      params: { readonly paywallId: string; readonly releaseId: string };
    }) =>
      client.paywallsActivatePaywallRelease(
        request.params["paywallId"],
        request.params["releaseId"],
      ),
    archivePaywall: (request: { params: { readonly paywallId: string } }) =>
      client.paywallsArchivePaywall(request.params["paywallId"]),
    createPaywall: (request: {
      payload: Parameters<VoidhashCoreClient["paywallsCreatePaywall"]>[0];
    }) => client.paywallsCreatePaywall(request.payload),
    createPaywallRelease: (request: { params: { readonly paywallId: string } }) =>
      client.paywallsCreatePaywallRelease(request.params["paywallId"]),
    getPaywall: (request: { params: { readonly paywallId: string } }) =>
      client.paywallsGetPaywall(request.params["paywallId"]),
    listPaywallReleases: (request: {
      params: {
        readonly paywallId: string;
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly status?: "draft" | null;
      };
    }) =>
      client.paywallsListPaywallReleases(request.params["paywallId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        status: request.params["status"],
      }),
    listPaywalls: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly includeArchived?: "true" | "false" | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.paywallsListPaywalls({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        includeArchived: request.params["includeArchived"],
        projectId: request.params["projectId"],
      }),
    publishPaywallRelease: (request: {
      params: { readonly paywallId: string; readonly releaseId: string };
    }) =>
      client.paywallsPublishPaywallRelease(
        request.params["paywallId"],
        request.params["releaseId"],
      ),
    restorePaywall: (request: { params: { readonly paywallId: string } }) =>
      client.paywallsRestorePaywall(request.params["paywallId"]),
    updatePaywall: (request: {
      params: { readonly paywallId: string };
      payload: Parameters<VoidhashCoreClient["paywallsUpdatePaywall"]>[1];
    }) => client.paywallsUpdatePaywall(request.params["paywallId"], request.payload),
  },
  perks: {
    createPerk: (request: { payload: Parameters<VoidhashCoreClient["perksCreatePerk"]>[0] }) =>
      client.perksCreatePerk(request.payload),
    deletePerk: (request: { params: { readonly perkId: string } }) =>
      client.perksDeletePerk(request.params["perkId"]),
    getPerk: (request: { params: { readonly perkId: string } }) =>
      client.perksGetPerk(request.params["perkId"]),
    listPerks: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.perksListPerks({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
      }),
    updatePerk: (request: {
      params: { readonly perkId: string };
      payload: Parameters<VoidhashCoreClient["perksUpdatePerk"]>[1];
    }) => client.perksUpdatePerk(request.params["perkId"], request.payload),
  },
  persons: {
    createPerson: (request: {
      payload: Parameters<VoidhashCoreClient["personsCreatePerson"]>[0];
    }) => client.personsCreatePerson(request.payload),
    getPersonById: (request: { params: { readonly personId: string } }) =>
      client.personsGetPersonById(request.params["personId"]),
    getPersonEntitlements: (request: { params: { readonly personId: string } }) =>
      client.personsGetPersonEntitlements(request.params["personId"]),
    listPersons: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly distinctId?: string | null;
        readonly email?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.personsListPersons({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        distinctId: request.params["distinctId"],
        email: request.params["email"],
        projectId: request.params["projectId"],
      }),
    updatePerson: (request: {
      params: { readonly personId: string };
      payload: Parameters<VoidhashCoreClient["personsUpdatePerson"]>[1];
    }) => client.personsUpdatePerson(request.params["personId"], request.payload),
  },
  products: {
    attachProductPerk: (request: {
      params: { readonly productId: string };
      payload: Parameters<VoidhashCoreClient["productsAttachProductPerk"]>[1];
    }) => client.productsAttachProductPerk(request.params["productId"], request.payload),
    createProduct: (request: {
      payload: Parameters<VoidhashCoreClient["productsCreateProduct"]>[0];
    }) => client.productsCreateProduct(request.payload),
    deleteProduct: (request: { params: { readonly productId: string } }) =>
      client.productsDeleteProduct(request.params["productId"]),
    detachProductPerk: (request: {
      params: { readonly productId: string; readonly perkId: string };
    }) => client.productsDetachProductPerk(request.params["productId"], request.params["perkId"]),
    getProduct: (request: { params: { readonly productId: string } }) =>
      client.productsGetProduct(request.params["productId"]),
    listProductPerks: (request: {
      params: {
        readonly productId: string;
        readonly cursor?: string | null;
        readonly limit?: string | null;
      };
    }) =>
      client.productsListProductPerks(request.params["productId"], {
        cursor: request.params["cursor"],
        limit: request.params["limit"],
      }),
    listProducts: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
        readonly type?: "subscription" | "one-time" | "one-time-consumable" | null;
      };
    }) =>
      client.productsListProducts({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
        type: request.params["type"],
      }),
    updateProduct: (request: {
      params: { readonly productId: string };
      payload: Parameters<VoidhashCoreClient["productsUpdateProduct"]>[1];
    }) => client.productsUpdateProduct(request.params["productId"], request.payload),
  },
  projects: {
    createProject: (request: {
      payload: Parameters<VoidhashCoreClient["projectsCreateProject"]>[0];
    }) => client.projectsCreateProject(request.payload),
    deleteProject: (request: { params: { readonly projectId: string } }) =>
      client.projectsDeleteProject(request.params["projectId"]),
    getProjectById: (request: { params: { readonly projectId: string } }) =>
      client.projectsGetProjectById(request.params["projectId"]),
    updateProject: (request: {
      params: { readonly projectId: string };
      payload: Parameters<VoidhashCoreClient["projectsUpdateProject"]>[1];
    }) => client.projectsUpdateProject(request.params["projectId"], request.payload),
  },
  pushNotificationConfigurations: {
    createPushNotificationConfiguration: (request: {
      payload: Parameters<
        VoidhashCoreClient["pushNotificationConfigurationsCreatePushNotificationConfiguration"]
      >[0];
    }) => client.pushNotificationConfigurationsCreatePushNotificationConfiguration(request.payload),
    deletePushNotificationConfiguration: (request: {
      params: { readonly configurationId: string };
    }) =>
      client.pushNotificationConfigurationsDeletePushNotificationConfiguration(
        request.params["configurationId"],
      ),
    getPushNotificationConfiguration: (request: { params: { readonly configurationId: string } }) =>
      client.pushNotificationConfigurationsGetPushNotificationConfiguration(
        request.params["configurationId"],
      ),
    listPushNotificationConfigurations: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
        readonly providerId?: string | null;
      };
    }) =>
      client.pushNotificationConfigurationsListPushNotificationConfigurations({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
        providerId: request.params["providerId"],
      }),
    updatePushNotificationConfiguration: (request: {
      params: { readonly configurationId: string };
      payload: Parameters<
        VoidhashCoreClient["pushNotificationConfigurationsUpdatePushNotificationConfiguration"]
      >[1];
    }) =>
      client.pushNotificationConfigurationsUpdatePushNotificationConfiguration(
        request.params["configurationId"],
        request.payload,
      ),
  },
  schema: {
    getSchema: (request: { params: { readonly projectId?: string | null } }) =>
      client.schemaGetSchema({ projectId: request.params["projectId"] }),
    getSchemaVersion: (request: { params: { readonly projectId?: string | null } }) =>
      client.schemaGetSchemaVersion({ projectId: request.params["projectId"] }),
  },
  users: {
    getUser: () => client.usersGetUser(),
  },
  webhooks: {
    createWebhookEndpoint: (request: {
      payload: Parameters<VoidhashCoreClient["webhooksCreateWebhookEndpoint"]>[0];
    }) => client.webhooksCreateWebhookEndpoint(request.payload),
    deleteWebhookEndpoint: (request: {
      params: { readonly endpointId: string; readonly projectId?: string | null };
    }) =>
      client.webhooksDeleteWebhookEndpoint(request.params["endpointId"], {
        projectId: request.params["projectId"],
      }),
    getWebhookDelivery: (request: {
      params: { readonly deliveryId: string; readonly projectId?: string | null };
    }) =>
      client.webhooksGetWebhookDelivery(request.params["deliveryId"], {
        projectId: request.params["projectId"],
      }),
    getWebhookEndpoint: (request: {
      params: { readonly endpointId: string; readonly projectId?: string | null };
    }) =>
      client.webhooksGetWebhookEndpoint(request.params["endpointId"], {
        projectId: request.params["projectId"],
      }),
    listWebhookDeliveries: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly endpointId?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.webhooksListWebhookDeliveries({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        endpointId: request.params["endpointId"],
        projectId: request.params["projectId"],
      }),
    listWebhookEndpoints: (request: {
      params: {
        readonly cursor?: string | null;
        readonly limit?: string | null;
        readonly projectId?: string | null;
      };
    }) =>
      client.webhooksListWebhookEndpoints({
        cursor: request.params["cursor"],
        limit: request.params["limit"],
        projectId: request.params["projectId"],
      }),
    retryWebhookDelivery: (request: {
      params: { readonly deliveryId: string; readonly projectId?: string | null };
    }) =>
      client.webhooksRetryWebhookDelivery(request.params["deliveryId"], {
        projectId: request.params["projectId"],
      }),
    rotateWebhookSecret: (request: {
      params: { readonly endpointId: string; readonly projectId?: string | null };
    }) =>
      client.webhooksRotateWebhookSecret(request.params["endpointId"], {
        projectId: request.params["projectId"],
      }),
    testWebhookEndpoint: (request: {
      params: { readonly endpointId: string; readonly projectId?: string | null };
    }) =>
      client.webhooksTestWebhookEndpoint(request.params["endpointId"], {
        projectId: request.params["projectId"],
      }),
    updateWebhookEndpoint: (request: {
      params: { readonly endpointId: string; readonly projectId?: string | null };
      payload: Parameters<VoidhashCoreClient["webhooksUpdateWebhookEndpoint"]>[1]["payload"];
    }) =>
      client.webhooksUpdateWebhookEndpoint(request.params["endpointId"], {
        params: { projectId: request.params["projectId"] },
        payload: request.payload,
      }),
  },
});

export type GroupedVoidhashNodeEffectClient = ReturnType<typeof groupCoreClient>;
