import { defineRelations } from "drizzle-orm";

import * as schema from "./schema.ts";

/**
 * v2 relational-query graph for `drizzle-orm/effect-postgres`'s `db.query.*`
 * relational queries. Mirrors the foreign keys declared on the tables in
 * `./schema.ts`. The relation names (the keys here) must match the `with: {…}`
 * clauses at call sites.
 *
 * Lives in its own module so `schema.ts` stays a pure table + type definition
 * file and `defineRelations` can take the whole table namespace (it ignores the
 * non-table exports — enums, types — automatically).
 */
export const relations = defineRelations(schema, (r) => ({
  user: {
    apikeys: r.many.apikey(),
    invitations: r.many.invitation(),
    members: r.many.member(),
  },
  organization: {
    invitations: r.many.invitation(),
    members: r.many.member(),
  },
  member: {
    organization: r.one.organization({ from: r.member.organizationId, to: r.organization.id }),
    user: r.one.user({ from: r.member.userId, to: r.user.id }),
  },
  invitation: {
    organization: r.one.organization({ from: r.invitation.organizationId, to: r.organization.id }),
    user: r.one.user({ from: r.invitation.inviterId, to: r.user.id }),
  },
  apikey: {
    user: r.one.user({ from: r.apikey.userId, to: r.user.id }),
  },
  projects: {
    organization: r.one.organization({ from: r.projects.organizationId, to: r.organization.id }),
  },
  captureProjectPolicies: {
    project: r.one.projects({ from: r.captureProjectPolicies.projectId, to: r.projects.id }),
  },
  apiKeys: {
    project: r.one.projects({ from: r.apiKeys.projectId, to: r.projects.id }),
  },
  persons: {
    externalIdentifiers: r.many.personExternalIdentifiers(),
    mergedIntoPerson: r.one.persons({ from: r.persons.mergedIntoPersonId, to: r.persons.id }),
  },
  personIdentities: {
    person: r.one.persons({ from: r.personIdentities.personId, to: r.persons.id }),
    project: r.one.projects({ from: r.personIdentities.projectId, to: r.projects.id }),
  },
  personPersonlessIdentities: {
    project: r.one.projects({ from: r.personPersonlessIdentities.projectId, to: r.projects.id }),
  },
  identityAssertions: {
    project: r.one.projects({ from: r.identityAssertions.projectId, to: r.projects.id }),
  },
  personIdentityMigrationJobs: {
    project: r.one.projects({ from: r.personIdentityMigrationJobs.projectId, to: r.projects.id }),
    targetPerson: r.one.persons({
      from: r.personIdentityMigrationJobs.targetPersonId,
      to: r.persons.id,
    }),
  },
  personExternalIdentifiers: {
    person: r.one.persons({ from: r.personExternalIdentifiers.personId, to: r.persons.id }),
    project: r.one.projects({ from: r.personExternalIdentifiers.projectId, to: r.projects.id }),
  },
  paymentProviderConfigurations: {
    paymentProviderConfigurationProducts: r.many.paymentProviderConfigurationProducts(),
    project: r.one.projects({ from: r.paymentProviderConfigurations.projectId, to: r.projects.id }),
  },
  perks: {
    productPerks: r.many.productPerks(),
  },
  products: {
    paymentProviderConfigurationProducts: r.many.paymentProviderConfigurationProducts(),
    perks: r.many.productPerks(),
  },
  productPerks: {
    perk: r.one.perks({ from: r.productPerks.perkId, to: r.perks.id }),
    product: r.one.products({ from: r.productPerks.productId, to: r.products.id }),
  },
  paymentProviderConfigurationProducts: {
    paymentProviderConfiguration: r.one.paymentProviderConfigurations({
      from: r.paymentProviderConfigurationProducts.paymentProviderConfigurationId,
      to: r.paymentProviderConfigurations.id,
    }),
    product: r.one.products({
      from: r.paymentProviderConfigurationProducts.productId,
      to: r.products.id,
    }),
    subscriptions: r.many.subscriptions(),
  },
  checkoutSessions: {
    person: r.one.persons({ from: r.checkoutSessions.personId, to: r.persons.id }),
    paymentProviderConfigurationProduct: r.one.paymentProviderConfigurationProducts({
      from: r.checkoutSessions.paymentProviderConfigurationProductId,
      to: r.paymentProviderConfigurationProducts.id,
    }),
  },
  subscriptions: {
    paymentProviderConfigurationProduct: r.one.paymentProviderConfigurationProducts({
      from: r.subscriptions.paymentProviderConfigurationProductId,
      to: r.paymentProviderConfigurationProducts.id,
    }),
  },
  paywalls: {
    project: r.one.projects({ from: r.paywalls.projectId, to: r.projects.id }),
  },
  paywallReleases: {
    paywall: r.one.paywalls({ from: r.paywallReleases.paywallId, to: r.paywalls.id }),
  },
  paywallLocations: {
    project: r.one.projects({ from: r.paywallLocations.projectId, to: r.projects.id }),
    showings: r.many.paywallLocationShowings(),
  },
  paywallLocationShowings: {
    location: r.one.paywallLocations({
      from: r.paywallLocationShowings.paywallLocationId,
      to: r.paywallLocations.id,
    }),
    paywall: r.one.paywalls({ from: r.paywallLocationShowings.paywallId, to: r.paywalls.id }),
    paywallRelease: r.one.paywallReleases({
      from: r.paywallLocationShowings.paywallReleaseId,
      to: r.paywallReleases.id,
    }),
    project: r.one.projects({ from: r.paywallLocationShowings.projectId, to: r.projects.id }),
  },
  paywallDeploys: {
    files: r.many.paywallDeployFiles(),
    project: r.one.projects({ from: r.paywallDeploys.projectId, to: r.projects.id }),
  },
  paywallDeployFiles: {
    deploy: r.one.paywallDeploys({ from: r.paywallDeployFiles.deployId, to: r.paywallDeploys.id }),
  },
  paywallComponents: {
    project: r.one.projects({ from: r.paywallComponents.projectId, to: r.projects.id }),
    versions: r.many.paywallComponentVersions(),
  },
  paywallComponentVersions: {
    component: r.one.paywallComponents({
      from: r.paywallComponentVersions.componentId,
      to: r.paywallComponents.id,
    }),
    deploy: r.one.paywallDeploys({
      from: r.paywallComponentVersions.deployId,
      to: r.paywallDeploys.id,
    }),
  },
  organizationBilling: {
    organization: r.one.organization({
      from: r.organizationBilling.organizationId,
      to: r.organization.id,
    }),
  },
  webhookEndpoints: {
    project: r.one.projects({ from: r.webhookEndpoints.projectId, to: r.projects.id }),
    deliveries: r.many.webhookDeliveries(),
  },
  webhookDeliveries: {
    endpoint: r.one.webhookEndpoints({
      from: r.webhookDeliveries.webhookEndpointId,
      to: r.webhookEndpoints.id,
    }),
    attempts: r.many.webhookDeliveryAttempts(),
  },
  webhookDeliveryAttempts: {
    delivery: r.one.webhookDeliveries({
      from: r.webhookDeliveryAttempts.webhookDeliveryId,
      to: r.webhookDeliveries.id,
    }),
  },
  featureFlags: {
    overrides: r.many.featureFlagOverrides(),
    targets: r.many.featureFlagTargets(),
    variants: r.many.featureFlagVariants(),
  },
  featureFlagTargets: {
    featureFlag: r.one.featureFlags({
      from: r.featureFlagTargets.featureFlagId,
      to: r.featureFlags.id,
    }),
  },
  featureFlagOverrides: {
    featureFlag: r.one.featureFlags({
      from: r.featureFlagOverrides.featureFlagId,
      to: r.featureFlags.id,
    }),
  },
  featureFlagVariants: {
    featureFlag: r.one.featureFlags({
      from: r.featureFlagVariants.featureFlagId,
      to: r.featureFlags.id,
    }),
  },
  experiments: {
    project: r.one.projects({ from: r.experiments.projectId, to: r.projects.id }),
    featureFlag: r.one.featureFlags({
      from: r.experiments.featureFlagId,
      to: r.featureFlags.id,
    }),
    variants: r.many.experimentVariants(),
    treatments: r.many.experimentTreatments(),
  },
  experimentVariants: {
    experiment: r.one.experiments({
      from: r.experimentVariants.experimentId,
      to: r.experiments.id,
    }),
    treatments: r.many.experimentTreatments(),
  },
  experimentTreatments: {
    experiment: r.one.experiments({
      from: r.experimentTreatments.experimentId,
      to: r.experiments.id,
    }),
    variant: r.one.experimentVariants({
      from: r.experimentTreatments.variantId,
      to: r.experimentVariants.id,
    }),
  },
  pushNotificationConfigs: {
    project: r.one.projects({ from: r.pushNotificationConfigs.projectId, to: r.projects.id }),
  },
  pushDeviceTokens: {
    project: r.one.projects({ from: r.pushDeviceTokens.projectId, to: r.projects.id }),
    personLinks: r.many.pushPersonDeviceTokens(),
  },
  pushPersonDeviceTokens: {
    person: r.one.persons({ from: r.pushPersonDeviceTokens.personId, to: r.persons.id }),
    deviceToken: r.one.pushDeviceTokens({
      from: r.pushPersonDeviceTokens.pushDeviceTokenId,
      to: r.pushDeviceTokens.id,
    }),
  },
  pushNotificationSends: {
    project: r.one.projects({ from: r.pushNotificationSends.projectId, to: r.projects.id }),
    deliveries: r.many.pushNotificationDeliveries(),
  },
  pushNotificationDeliveries: {
    send: r.one.pushNotificationSends({
      from: r.pushNotificationDeliveries.pushNotificationSendId,
      to: r.pushNotificationSends.id,
    }),
    attempts: r.many.pushNotificationDeliveryAttempts(),
  },
  pushNotificationDeliveryAttempts: {
    delivery: r.one.pushNotificationDeliveries({
      from: r.pushNotificationDeliveryAttempts.pushNotificationDeliveryId,
      to: r.pushNotificationDeliveries.id,
    }),
  },
}));
