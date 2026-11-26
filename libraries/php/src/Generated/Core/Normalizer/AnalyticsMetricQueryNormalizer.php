<?php

namespace Voidhash\Generated\Core\Normalizer;

use Jane\Component\JsonSchemaRuntime\Reference;
use Voidhash\Generated\Core\Runtime\Normalizer\CheckArray;
use Voidhash\Generated\Core\Runtime\Normalizer\ValidatorTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
class AnalyticsMetricQueryNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsMetricQuery::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsMetricQuery::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsMetricQuery();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isCumulative', $data) && \is_int($data['isCumulative'])) {
            $data['isCumulative'] = (bool) $data['isCumulative'];
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('metric', $data)) {
            $value = $data['metric'];
            if (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'mrr')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsMrrMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'revenue')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsRevenueMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'new_mrr')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsNewMrrMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'expansion_mrr')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsExpansionMrrMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'reactivation_mrr')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsReactivationMrrMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'contraction_mrr')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsContractionMrrMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'churned_mrr')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsChurnedMrrMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'net_new_mrr')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsNetNewMrrMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'refunds')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsRefundsMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'active_subscriptions')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsActiveSubscriptionsMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'active_trials')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsActiveTrialsMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'new_subscriptions')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsNewSubscriptionsMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'churned_subscriptions')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsChurnedSubscriptionsMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'new_trials')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsNewTrialsMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'trial_conversions')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsTrialConversionsMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'paying_customers')) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsPayingCustomersMetric::class, 'json', $context);
            } elseif (is_array($data['metric']) and (\array_key_exists('kind', $data['metric']) and $data['metric']['kind'] == 'event') and \array_key_exists('eventName', $data['metric']) and (\array_key_exists('aggregation', $data['metric']) and ($data['metric']['aggregation'] == 'count' or $data['metric']['aggregation'] == 'unique_people' or $data['metric']['aggregation'] == 'unique_sessions' or $data['metric']['aggregation'] == 'unique_groups' or $data['metric']['aggregation'] == 'first_time' or $data['metric']['aggregation'] == 'weekly_active' or $data['metric']['aggregation'] == 'monthly_active' or $data['metric']['aggregation'] == 'per_person' or $data['metric']['aggregation'] == 'property'))) {
                $value = $this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsEventMetric::class, 'json', $context);
            }
            $object->setMetric($value);
        }
        if (\array_key_exists('timeRange', $data)) {
            $value_1 = $data['timeRange'];
            if (is_array($data['timeRange']) and (\array_key_exists('preset', $data['timeRange']) and ($data['timeRange']['preset'] == 'today' or $data['timeRange']['preset'] == 'last_7d' or $data['timeRange']['preset'] == 'last_30d' or $data['timeRange']['preset'] == 'last_90d' or $data['timeRange']['preset'] == 'last_365d' or $data['timeRange']['preset'] == 'mtd' or $data['timeRange']['preset'] == 'qtd' or $data['timeRange']['preset'] == 'ytd'))) {
                $value_1 = $this->denormalizer->denormalize($data['timeRange'], \Voidhash\Generated\Core\Model\AnalyticsPresetTimeRange::class, 'json', $context);
            } elseif (is_array($data['timeRange']) and \array_key_exists('end', $data['timeRange']) and (\array_key_exists('preset', $data['timeRange']) and $data['timeRange']['preset'] == 'custom') and \array_key_exists('start', $data['timeRange'])) {
                $value_1 = $this->denormalizer->denormalize($data['timeRange'], \Voidhash\Generated\Core\Model\AnalyticsCustomTimeRange::class, 'json', $context);
            }
            $object->setTimeRange($value_1);
        }
        if (\array_key_exists('granularity', $data) && $data['granularity'] !== null) {
            $object->setGranularity($data['granularity']);
        }
        elseif (\array_key_exists('granularity', $data) && $data['granularity'] === null) {
            $object->setGranularity(null);
        }
        if (\array_key_exists('timezone', $data) && $data['timezone'] !== null) {
            $object->setTimezone($data['timezone']);
        }
        elseif (\array_key_exists('timezone', $data) && $data['timezone'] === null) {
            $object->setTimezone(null);
        }
        if (\array_key_exists('filters', $data) && $data['filters'] !== null) {
            $values = [];
            foreach ($data['filters'] as $value_2) {
                $values[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\AnalyticsMetricFilter::class, 'json', $context);
            }
            $object->setFilters($values);
        }
        elseif (\array_key_exists('filters', $data) && $data['filters'] === null) {
            $object->setFilters(null);
        }
        if (\array_key_exists('split', $data)) {
            $value_3 = $data['split'];
            if (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'store')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsStoreDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'product')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsProductDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'store_product')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsStoreProductDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'country')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsCountryDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'billing_period')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsBillingPeriodDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'paywall')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsPaywallDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'placement')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsPlacementDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'offer')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsOfferDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'acquisition_source')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsAcquisitionSourceDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'plan')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsPlanDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'trait') and \array_key_exists('key', $data['split'])) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsTraitDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'property') and \array_key_exists('key', $data['split'])) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsPropertyDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'cohort')) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsCohortDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'group') and \array_key_exists('groupType', $data['split'])) {
                $value_3 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\AnalyticsGroupDimension::class, 'json', $context);
            }
            $object->setSplit($value_3);
        }
        if (\array_key_exists('comparison', $data) && $data['comparison'] !== null) {
            $object->setComparison($data['comparison']);
        }
        elseif (\array_key_exists('comparison', $data) && $data['comparison'] === null) {
            $object->setComparison(null);
        }
        if (\array_key_exists('comparisonRange', $data)) {
            $object->setComparisonRange($this->denormalizer->denormalize($data['comparisonRange'], \Voidhash\Generated\Core\Model\AnalyticsMetricComparisonRange::class, 'json', $context));
        }
        if (\array_key_exists('isCumulative', $data) && $data['isCumulative'] !== null) {
            $object->setIsCumulative($data['isCumulative']);
        }
        elseif (\array_key_exists('isCumulative', $data) && $data['isCumulative'] === null) {
            $object->setIsCumulative(null);
        }
        if (\array_key_exists('limit', $data) && $data['limit'] !== null) {
            $object->setLimit($data['limit']);
        }
        elseif (\array_key_exists('limit', $data) && $data['limit'] === null) {
            $object->setLimit(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['key'] = $data->getKey();
        $value = $data->getMetric();
        if (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        } elseif (is_object($data->getMetric())) {
            $value = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        }
        $dataArray['metric'] = $value;
        $value_1 = $data->getTimeRange();
        if (is_object($data->getTimeRange())) {
            $value_1 = $this->normalizer->normalize($data->getTimeRange(), 'json', $context);
        } elseif (is_object($data->getTimeRange())) {
            $value_1 = $this->normalizer->normalize($data->getTimeRange(), 'json', $context);
        }
        $dataArray['timeRange'] = $value_1;
        if ($data->isInitialized('granularity')) {
            $dataArray['granularity'] = $data->getGranularity();
        }
        if ($data->isInitialized('timezone')) {
            $dataArray['timezone'] = $data->getTimezone();
        }
        if ($data->isInitialized('filters')) {
            $values = [];
            foreach ($data->getFilters() as $value_2) {
                $values[] = $this->normalizer->normalize($value_2, 'json', $context);
            }
            $dataArray['filters'] = $values;
        }
        if ($data->isInitialized('split') && null !== $data->getSplit()) {
            $value_3 = $data->getSplit();
            if (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_3 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            }
            $dataArray['split'] = $value_3;
        }
        if ($data->isInitialized('comparison')) {
            $dataArray['comparison'] = $data->getComparison();
        }
        if ($data->isInitialized('comparisonRange') && null !== $data->getComparisonRange()) {
            $dataArray['comparisonRange'] = $this->normalizer->normalize($data->getComparisonRange(), 'json', $context);
        }
        if ($data->isInitialized('isCumulative')) {
            $dataArray['isCumulative'] = $data->getIsCumulative();
        }
        if ($data->isInitialized('limit')) {
            $dataArray['limit'] = $data->getLimit();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsMetricQuery::class => false];
    }
}