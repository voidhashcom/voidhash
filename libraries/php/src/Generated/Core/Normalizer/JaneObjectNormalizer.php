<?php

namespace Voidhash\Generated\Core\Normalizer;

use Voidhash\Generated\Core\Runtime\Normalizer\CheckArray;
use Voidhash\Generated\Core\Runtime\Normalizer\ValidatorTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
class JaneObjectNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    protected $normalizers = [
        
        \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiActionForbiddenErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiAuthenticationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiNotAuthenticatedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateSecretKeyBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiKeyWithRawKeyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiApiKeyServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiApiKeyServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiKeyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiApiKeyNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePersonBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPersonInvalidAnonymousIdErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPersonInvalidAnonymousIdErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPersonServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPersonServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPersonNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkEntitlementGrantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonEntitlementsResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SendNotificationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SendNotificationResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SendNotificationResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushSendServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushSendServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushDeviceValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushSendNotEnabledErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushSendNotEnabledErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateOrganizationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\OrganizationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiOrganizationServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiOrganizationServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPerkServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPerkServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallDeployResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployUpgradeRequiredErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiDeployBlobHashMismatchErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiDeployBlobHashMismatchErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiDeployBlobNotDeclaredErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiDeployBlobNotDeclaredErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployNotPendingErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FinalizedPaywallDeployComponentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FinalizedPaywallDeployComponentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FinalizedPaywallDeployPaywallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FinalizedPaywallDeployPaywallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FinalizePaywallDeployResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiIncompleteDeployErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallLocationServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallLocationServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaPerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaPerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaProductProviderJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaProductProviderJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProjectSchemaResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSchemaServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSchemaServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaVersionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateProjectBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProjectJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProjectServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProjectServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProductPerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProductPerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductPerkServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductPerkServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductPerkValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPurchaseHistoryEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkPurchaseHistoryEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkCurrentSubscriptionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkCurrentSubscriptionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSubscriptionHistoryEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingEntitlements::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingEntitlementsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingPurchases::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingPurchasesNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSnapshotContext::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingSnapshotContextNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSubscriptions::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingSubscriptionsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkPersonNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkPersonNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkIdentifyBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSyncPersonAttributesBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSyncTransactionResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSyncTransactionResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkDevelopmentPurchaseBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkDevelopmentPurchaseResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\EvaluateFeatureFlagsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkFeatureFlagResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkFeatureFlagResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkFeatureFlagsResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkResolvePaywallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywall::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingPaywallNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntimeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncodingLocation::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallJsonEncodingLocationNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaPerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaPerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfiguration::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingConfigurationNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProviders::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingConfigurationProvidersNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingConfigurationProvidersDevelopmentNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingProperties::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingPropertiesNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RegisterDeviceBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RegisterDeviceResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushDeviceServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushDeviceServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushDeviceNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RefreshDeviceBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UnregisterDeviceBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UserJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UserJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UserJsonEncodingOrganizationsItem::class => \Voidhash\Generated\Core\Normalizer\UserJsonEncodingOrganizationsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UserJsonEncodingProjectsItem::class => \Voidhash\Generated\Core\Normalizer\UserJsonEncodingProjectsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiUserServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiUserServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderConfigurationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderConfigurationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderConfigurationServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderProductServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderProductServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateWebhookEndpointBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookEndpointJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookEndpointNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateWebhookEndpointBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryAttemptJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryWithAttemptsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookDeliveryNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1AuthSessionGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200OrganizationsItem::class => \Voidhash\Generated\Core\Normalizer\ApiV1AuthSessionGetResponse200OrganizationsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200ProjectsItem::class => \Voidhash\Generated\Core\Normalizer\ApiV1AuthSessionGetResponse200ProjectsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody::class => \Voidhash\Generated\Core\Normalizer\ApiV1SdkSyncTransactionPostBodyNormalizer::class,
        
        \Jane\Component\JsonSchemaRuntime\Reference::class => \Voidhash\Generated\Core\Runtime\Normalizer\ReferenceNormalizer::class,
    ], $normalizersCache = [];
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return array_key_exists($type, $this->normalizers);
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && array_key_exists(get_class($data), $this->normalizers);
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $normalizerClass = $this->normalizers[get_class($data)];
        $normalizer = $this->getNormalizer($normalizerClass);
        return $normalizer->normalize($data, $format, $context);
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $denormalizerClass = $this->normalizers[$type];
        $denormalizer = $this->getNormalizer($denormalizerClass);
        return $denormalizer->denormalize($data, $type, $format, $context);
    }
    private function getNormalizer(string $normalizerClass)
    {
        return $this->normalizersCache[$normalizerClass] ?? $this->initNormalizer($normalizerClass);
    }
    private function initNormalizer(string $normalizerClass)
    {
        $normalizer = new $normalizerClass();
        $normalizer->setNormalizer($this->normalizer);
        $normalizer->setDenormalizer($this->denormalizer);
        $this->normalizersCache[$normalizerClass] = $normalizer;
        return $normalizer;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [
            
            \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiApiKeyServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPersonInvalidAnonymousIdErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPersonServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SendNotificationResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushSendServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushSendNotEnabledErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiOrganizationServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPerkServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiDeployBlobHashMismatchErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiDeployBlobNotDeclaredErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FinalizedPaywallDeployComponentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FinalizedPaywallDeployPaywallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallLocationServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaPerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaProductProviderJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSchemaServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProjectServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProductPerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductPerkServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPurchaseHistoryEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkCurrentSubscriptionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingEntitlements::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingPurchases::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSnapshotContext::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSubscriptions::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkPersonNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSyncTransactionResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkFeatureFlagResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywall::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncodingLocation::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaPerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfiguration::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProviders::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingProperties::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushDeviceServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UserJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UserJsonEncodingOrganizationsItem::class => false,
            \Voidhash\Generated\Core\Model\UserJsonEncodingProjectsItem::class => false,
            \Voidhash\Generated\Core\Model\ApiUserServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderConfigurationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderProductServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200OrganizationsItem::class => false,
            \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200ProjectsItem::class => false,
            \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody::class => false,
            \Jane\Component\JsonSchemaRuntime\Reference::class => false,
        ];
    }
}