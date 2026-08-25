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
        
        \Voidhash\Generated\Core\Model\AnalyticsBreakdown::class => \Voidhash\Generated\Core\Normalizer\AnalyticsBreakdownNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class => \Voidhash\Generated\Core\Normalizer\AnalyticsFilterPredicateNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class => \Voidhash\Generated\Core\Normalizer\AnalyticsInsightQueryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\QueryInsightsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\QueryInsightsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsDataPoint::class => \Voidhash\Generated\Core\Normalizer\AnalyticsDataPointNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsSummary::class => \Voidhash\Generated\Core\Normalizer\AnalyticsSummaryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsInsightResponseItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItemResolvedTimeRange::class => \Voidhash\Generated\Core\Normalizer\AnalyticsInsightResponseItemResolvedTimeRangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\QueryInsightsResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\QueryInsightsResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiActionForbiddenErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiAnalyticsServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiAnalyticsServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiAuthServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiInvalidMetricErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiInvalidMetricErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiInvalidTimeRangeErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiInvalidTimeRangeErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiUnknownInsightErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiUnknownInsightErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiAuthenticationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiNotAuthenticatedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateSecretKeyBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiKeyWithRawKeyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiApiKeyServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiApiKeyServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiKeyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PageInfo::class => \Voidhash\Generated\Core\Normalizer\PageInfoNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiApiKeyNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevelopmentSettings::class => \Voidhash\Generated\Core\Normalizer\DevelopmentSettingsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiDevelopmentEnvironmentRequiredErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiDevelopmentEnvironmentRequiredErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiDevelopmentModeServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiDevelopmentModeServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateDevelopmentSettingsBody::class => \Voidhash\Generated\Core\Normalizer\UpdateDevelopmentSettingsBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevelopmentState::class => \Voidhash\Generated\Core\Normalizer\DevelopmentStateNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevelopmentStateGrantsItem::class => \Voidhash\Generated\Core\Normalizer\DevelopmentStateGrantsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevelopmentStatePurchasesItem::class => \Voidhash\Generated\Core\Normalizer\DevelopmentStatePurchasesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevelopmentStateSubscriptionsItem::class => \Voidhash\Generated\Core\Normalizer\DevelopmentStateSubscriptionsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevelopmentLifecycleActionBody::class => \Voidhash\Generated\Core\Normalizer\DevelopmentLifecycleActionBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsEventJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentListItemJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentListItemJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiExperimentServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiExperimentServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateExperimentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentBackingFlagJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentBackingFlagJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentTreatmentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentTreatmentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentVariantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\ExperimentJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiExperimentNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiExperimentNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateExperimentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncodingVariantsItem::class => \Voidhash\Generated\Core\Normalizer\UpdateExperimentBodyJsonEncodingVariantsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncodingVariantsItemTreatmentsItem::class => \Voidhash\Generated\Core\Normalizer\UpdateExperimentBodyJsonEncodingVariantsItemTreatmentsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiExperimentConflictErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiExperimentConflictErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiExperimentVariantNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiExperimentVariantNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiExperimentValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiExperimentValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ConcludeExperimentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentVariantResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentResultsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentResultsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagOverrideJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiFeatureFlagNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiFeatureFlagServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiFeatureFlagServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpsertFeatureFlagOverrideBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagOverrideJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiFeatureFlagOverrideNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiFeatureFlagOverrideNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagTargetJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagTargetJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpsertFeatureFlagTargetBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagTargetJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagTargetJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiFeatureFlagTargetNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiFeatureFlagTargetNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagListItemJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagListItemJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateFeatureFlagBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncodingVariantsItem::class => \Voidhash\Generated\Core\Normalizer\CreateFeatureFlagBodyJsonEncodingVariantsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagVariantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagVariantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiFeatureFlagKeyAlreadyExistsErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateFeatureFlagBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ReplaceFeatureFlagVariantsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem::class => \Voidhash\Generated\Core\Normalizer\ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\EvaluateProjectFeatureFlagsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkFeatureFlagResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkFeatureFlagResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkFeatureFlagsResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\BuiltinEventAdmission::class => \Voidhash\Generated\Core\Normalizer\BuiltinEventAdmissionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\EventAdmissionPolicyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\EventAdmissionPolicyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiEventAdmissionErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiEventAdmissionErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SetBuiltinEventAdmissionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SetBuiltinEventAdmissionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SetCustomEventBlockedBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SetCustomEventBlockedBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PushNotificationSend::class => \Voidhash\Generated\Core\Normalizer\PushNotificationSendNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushNotificationSendServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushNotificationSendServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PushNotificationDelivery::class => \Voidhash\Generated\Core\Normalizer\PushNotificationDeliveryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushNotificationSendNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushNotificationSendNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SendNotificationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SendNotificationResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SendNotificationResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushSendServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushSendServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushDeviceValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushSendNotEnabledErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushSendNotEnabledErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateOrganizationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\OrganizationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiOrganizationServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiOrganizationServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\OrganizationJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiOrganizationNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiOrganizationNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateOrganizationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProjectJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProjectServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProjectServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderConfigurationServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaymentProviderConfigurationBody::class => \Voidhash\Generated\Core\Normalizer\CreatePaymentProviderConfigurationBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderAlreadyExistsErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderAlreadyExistsErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderConfigurationNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderConfigurationValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaymentProviderConfigurationBody::class => \Voidhash\Generated\Core\Normalizer\UpdatePaymentProviderConfigurationBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationKeyUnavailableErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderConfigurationKeyUnavailableErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderProductServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderProductServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaymentProviderProductBody::class => \Voidhash\Generated\Core\Normalizer\CreatePaymentProviderProductBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderProductNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaymentProviderProductValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductBody::class => \Voidhash\Generated\Core\Normalizer\UpdatePaymentProviderProductBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallDeployJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallDeployJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallDeployJsonEncodingComponentsItem::class => \Voidhash\Generated\Core\Normalizer\PaywallDeployJsonEncodingComponentsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallDeployJsonEncodingPaywallsItem::class => \Voidhash\Generated\Core\Normalizer\PaywallDeployJsonEncodingPaywallsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallDeployResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployUpgradeRequiredErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiDeployBlobHashMismatchErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiDeployBlobHashMismatchErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiDeployBlobNotDeclaredErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiDeployBlobNotDeclaredErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallDeployNotPendingErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FinalizedPaywallDeployComponentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FinalizedPaywallDeployComponentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FinalizedPaywallDeployPaywallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FinalizedPaywallDeployPaywallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FinalizePaywallDeployResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiIncompleteDeployErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallLocationServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallLocationServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallLocationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallLocationSlugAlreadyExistsErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallLocationNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallLocationNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaywallLocationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SetPaywallLocationShowingBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationShowingJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncodingPaywall::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationShowingJsonEncodingPaywallNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncodingPaywallRelease::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationShowingJsonEncodingPaywallReleaseNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallLocationShowingValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallLocationShowingValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\PaywallJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallSlugAlreadyExistsErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallSlugAlreadyExistsErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaywallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallReleaseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallReleaseErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallReleaseErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\PaywallReleaseJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallReleaseNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallReleaseNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPaywallPublishErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPaywallPublishErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ActivatedPaywallReleaseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ActivatedPaywallReleaseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPerkServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPerkServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePerkBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PerkJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\PerkJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPerkSlugAlreadyExistsErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPerkSlugAlreadyExistsErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPerkNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPerkNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePerkBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePersonRequestBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePersonRequestBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPersonServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPersonServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\PersonJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPersonNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePersonBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkEntitlementGrantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonEntitlementsResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPerkGrantServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPerkGrantServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateProductBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProductJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\ProductJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductSlugAlreadyExistsErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductSlugAlreadyExistsErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateProductBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProductPerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProductPerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductPerkServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductPerkServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductPerkValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AttachProductPerkBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AttachProductPerkBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProductPerkJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\ProductPerkJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductPerkAlreadyExistsErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductPerkAlreadyExistsErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProductPerkNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProductPerkNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateProjectBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\ProjectJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiProjectNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiProjectNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateProjectBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushNotificationConfigurationServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBody::class => \Voidhash\Generated\Core\Normalizer\CreatePushNotificationConfigurationBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushNotificationConfigurationNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBody::class => \Voidhash\Generated\Core\Normalizer\UpdatePushNotificationConfigurationBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushNotificationConfigurationValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaPerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaPerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaProductProviderJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaProductProviderJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProjectSchemaResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSchemaServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSchemaServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaVersionJsonEncodingNormalizer::class,
        
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
        
        \Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateWebhookEndpointBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookEndpointWithSecretJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookEndpointWithSecretJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookEndpointJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookEndpointNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateWebhookEndpointBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookEndpointWithSecretJsonEncoding1::class => \Voidhash\Generated\Core\Normalizer\WebhookEndpointWithSecretJsonEncoding1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryAttemptJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryWithAttemptsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiWebhookDeliveryNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderConfigurationSummary::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderConfigurationSummaryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderProductSummary::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderProductSummaryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PushNotificationConfigurationSummary::class => \Voidhash\Generated\Core\Normalizer\PushNotificationConfigurationSummaryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ApiKeysGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ApiKeysGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1AuthSessionGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200OrganizationsItem::class => \Voidhash\Generated\Core\Normalizer\ApiV1AuthSessionGetResponse200OrganizationsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200ProjectsItem::class => \Voidhash\Generated\Core\Normalizer\ApiV1AuthSessionGetResponse200ProjectsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1DevelopmentLifecycleActionsPostResponse202::class => \Voidhash\Generated\Core\Normalizer\ApiV1DevelopmentLifecycleActionsPostResponse202Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1EventsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1EventsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ExperimentsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ExperimentsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1FeatureFlagOverridesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1FeatureFlagOverridesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1FeatureFlagTargetsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1FeatureFlagTargetsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1FeatureFlagsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1FeatureFlagsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1NotificationSendsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1NotificationSendsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1NotificationSendsSendIdDeliveriesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1NotificationSendsSendIdDeliveriesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1OrganizationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1OrganizationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdProjectsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1OrganizationsOrganizationIdProjectsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaymentProviderConfigurationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsPostResponse201::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaymentProviderConfigurationsPostResponse201Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaymentProviderProductsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaymentProviderProductsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaymentProviderProductsPostResponse201::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaymentProviderProductsPostResponse201Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaywallDeploysGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaywallDeploysGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaywallLocationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaywallLocationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaywallLocationsLocationIdShowingsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaywallLocationsLocationIdShowingsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaywallsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaywallsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PaywallsPaywallIdReleasesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PaywallsPaywallIdReleasesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PerksGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PerksGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PersonsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PersonsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProductsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProductsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProductsProductIdPerksGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProductsProductIdPerksGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1PushNotificationConfigurationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201::class => \Voidhash\Generated\Core\Normalizer\ApiV1PushNotificationConfigurationsPostResponse201Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody::class => \Voidhash\Generated\Core\Normalizer\ApiV1SdkSyncTransactionPostBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1WebhooksEndpointsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1WebhooksEndpointsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1WebhooksDeliveriesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1WebhooksDeliveriesGetResponse200Normalizer::class,
        
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
            
            \Voidhash\Generated\Core\Model\AnalyticsBreakdown::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class => false,
            \Voidhash\Generated\Core\Model\QueryInsightsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsDataPoint::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsSummary::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItemResolvedTimeRange::class => false,
            \Voidhash\Generated\Core\Model\QueryInsightsResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiAnalyticsServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiInvalidMetricErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiInvalidTimeRangeErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiUnknownInsightErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiApiKeyServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PageInfo::class => false,
            \Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\DevelopmentSettings::class => false,
            \Voidhash\Generated\Core\Model\ApiDevelopmentEnvironmentRequiredErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiDevelopmentModeServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateDevelopmentSettingsBody::class => false,
            \Voidhash\Generated\Core\Model\DevelopmentState::class => false,
            \Voidhash\Generated\Core\Model\DevelopmentStateGrantsItem::class => false,
            \Voidhash\Generated\Core\Model\DevelopmentStatePurchasesItem::class => false,
            \Voidhash\Generated\Core\Model\DevelopmentStateSubscriptionsItem::class => false,
            \Voidhash\Generated\Core\Model\DevelopmentLifecycleActionBody::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentListItemJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiExperimentServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentBackingFlagJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentTreatmentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiExperimentNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncodingVariantsItem::class => false,
            \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncodingVariantsItemTreatmentsItem::class => false,
            \Voidhash\Generated\Core\Model\ApiExperimentConflictErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiExperimentVariantNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiExperimentValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentResultsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiFeatureFlagServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiFeatureFlagOverrideNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagTargetJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagTargetJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiFeatureFlagTargetNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagListItemJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncodingVariantsItem::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagVariantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem::class => false,
            \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkFeatureFlagResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\BuiltinEventAdmission::class => false,
            \Voidhash\Generated\Core\Model\EventAdmissionPolicyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiEventAdmissionErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SetBuiltinEventAdmissionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SetCustomEventBlockedBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PushNotificationSend::class => false,
            \Voidhash\Generated\Core\Model\ApiPushNotificationSendServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PushNotificationDelivery::class => false,
            \Voidhash\Generated\Core\Model\ApiPushNotificationSendNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SendNotificationResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushSendServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushSendNotEnabledErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiOrganizationServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiOrganizationNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProjectServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaymentProviderConfigurationBody::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderAlreadyExistsErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaymentProviderConfigurationBody::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationKeyUnavailableErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderProductServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaymentProviderProductBody::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductBody::class => false,
            \Voidhash\Generated\Core\Model\PaywallDeployJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallDeployJsonEncodingComponentsItem::class => false,
            \Voidhash\Generated\Core\Model\PaywallDeployJsonEncodingPaywallsItem::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiDeployBlobHashMismatchErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiDeployBlobNotDeclaredErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FinalizedPaywallDeployComponentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FinalizedPaywallDeployPaywallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallLocationServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallLocationNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncodingPaywall::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncodingPaywallRelease::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallLocationShowingValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallSlugAlreadyExistsErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallReleaseErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallReleaseNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPaywallPublishErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ActivatedPaywallReleaseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPerkServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PerkJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiPerkSlugAlreadyExistsErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPerkNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePersonRequestBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPersonServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPerkGrantServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProductJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiProductSlugAlreadyExistsErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProductPerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductPerkServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AttachProductPerkBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProductPerkJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiProductPerkAlreadyExistsErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiProductPerkNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\ApiProjectNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBody::class => false,
            \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBody::class => false,
            \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaPerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaProductProviderJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSchemaServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding::class => false,
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
            \Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookEndpointWithSecretJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookEndpointWithSecretJsonEncoding1::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderConfigurationSummary::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderProductSummary::class => false,
            \Voidhash\Generated\Core\Model\PushNotificationConfigurationSummary::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ApiKeysGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200OrganizationsItem::class => false,
            \Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200ProjectsItem::class => false,
            \Voidhash\Generated\Core\Model\ApiV1DevelopmentLifecycleActionsPostResponse202::class => false,
            \Voidhash\Generated\Core\Model\ApiV1EventsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ExperimentsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1FeatureFlagOverridesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1FeatureFlagTargetsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1FeatureFlagsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1NotificationSendsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1NotificationSendsSendIdDeliveriesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1OrganizationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdProjectsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsPostResponse201::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaymentProviderProductsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaymentProviderProductsPostResponse201::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaywallDeploysGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaywallLocationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaywallLocationsLocationIdShowingsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaywallsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PaywallsPaywallIdReleasesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PerksGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PersonsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProductsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProductsProductIdPerksGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201::class => false,
            \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody::class => false,
            \Voidhash\Generated\Core\Model\ApiV1WebhooksEndpointsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1WebhooksDeliveriesGetResponse200::class => false,
            \Jane\Component\JsonSchemaRuntime\Reference::class => false,
        ];
    }
}