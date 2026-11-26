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
class AnalyticsInsightQueryNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsInsightQuery();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('breakdowns', $data) && $data['breakdowns'] !== null) {
            $values = [];
            foreach ($data['breakdowns'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsBreakdown::class, 'json', $context);
            }
            $object->setBreakdowns($values);
        }
        elseif (\array_key_exists('breakdowns', $data) && $data['breakdowns'] === null) {
            $object->setBreakdowns(null);
        }
        if (\array_key_exists('basis', $data)) {
            $object->setBasis($data['basis']);
        }
        if (\array_key_exists('filter', $data)) {
            $value_1 = $data['filter'];
            if (is_array($data['filter']) and \array_key_exists('field', $data['filter']) and (\array_key_exists('op', $data['filter']) and ($data['filter']['op'] == 'eq' or $data['filter']['op'] == 'neq' or $data['filter']['op'] == 'in' or $data['filter']['op'] == 'not_in' or $data['filter']['op'] == 'gt' or $data['filter']['op'] == 'gte' or $data['filter']['op'] == 'lt' or $data['filter']['op'] == 'lte' or $data['filter']['op'] == 'contains' or $data['filter']['op'] == 'exists')) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'predicate')) {
                $value_1 = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class, 'json', $context);
            } elseif (is_array($data['filter']) and \array_key_exists('filters', $data['filter']) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'and')) {
                $value_1 = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterAnd::class, 'json', $context);
            } elseif (is_array($data['filter']) and \array_key_exists('filters', $data['filter']) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'or')) {
                $value_1 = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterOr::class, 'json', $context);
            } elseif (is_array($data['filter']) and \array_key_exists('filter', $data['filter']) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'not')) {
                $value_1 = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterNot::class, 'json', $context);
            }
            $object->setFilter($value_1);
        }
        if (\array_key_exists('granularity', $data) && $data['granularity'] !== null) {
            $object->setGranularity($data['granularity']);
        }
        elseif (\array_key_exists('granularity', $data) && $data['granularity'] === null) {
            $object->setGranularity(null);
        }
        if (\array_key_exists('insightId', $data)) {
            $object->setInsightId($data['insightId']);
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('limit', $data) && $data['limit'] !== null) {
            $object->setLimit($data['limit']);
        }
        elseif (\array_key_exists('limit', $data) && $data['limit'] === null) {
            $object->setLimit(null);
        }
        if (\array_key_exists('timeRange', $data)) {
            $value_2 = $data['timeRange'];
            if (is_array($data['timeRange']) and (\array_key_exists('preset', $data['timeRange']) and ($data['timeRange']['preset'] == 'today' or $data['timeRange']['preset'] == 'last_7d' or $data['timeRange']['preset'] == 'last_30d' or $data['timeRange']['preset'] == 'last_90d' or $data['timeRange']['preset'] == 'last_365d' or $data['timeRange']['preset'] == 'mtd' or $data['timeRange']['preset'] == 'qtd' or $data['timeRange']['preset'] == 'ytd'))) {
                $value_2 = $this->denormalizer->denormalize($data['timeRange'], \Voidhash\Generated\Core\Model\AnalyticsPresetTimeRange::class, 'json', $context);
            } elseif (is_array($data['timeRange']) and \array_key_exists('end', $data['timeRange']) and (\array_key_exists('preset', $data['timeRange']) and $data['timeRange']['preset'] == 'custom') and \array_key_exists('start', $data['timeRange'])) {
                $value_2 = $this->denormalizer->denormalize($data['timeRange'], \Voidhash\Generated\Core\Model\AnalyticsCustomTimeRange::class, 'json', $context);
            }
            $object->setTimeRange($value_2);
        }
        if (\array_key_exists('timezone', $data) && $data['timezone'] !== null) {
            $object->setTimezone($data['timezone']);
        }
        elseif (\array_key_exists('timezone', $data) && $data['timezone'] === null) {
            $object->setTimezone(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('breakdowns')) {
            $values = [];
            foreach ($data->getBreakdowns() as $value) {
                $values[] = $this->normalizer->normalize($value, 'json', $context);
            }
            $dataArray['breakdowns'] = $values;
        }
        if ($data->isInitialized('basis') && null !== $data->getBasis()) {
            $dataArray['basis'] = $data->getBasis();
        }
        if ($data->isInitialized('filter') && null !== $data->getFilter()) {
            $value_1 = $data->getFilter();
            if (is_object($data->getFilter())) {
                $value_1 = $this->normalizer->normalize($data->getFilter(), 'json', $context);
            } elseif (is_object($data->getFilter())) {
                $value_1 = $this->normalizer->normalize($data->getFilter(), 'json', $context);
            } elseif (is_object($data->getFilter())) {
                $value_1 = $this->normalizer->normalize($data->getFilter(), 'json', $context);
            } elseif (is_object($data->getFilter())) {
                $value_1 = $this->normalizer->normalize($data->getFilter(), 'json', $context);
            }
            $dataArray['filter'] = $value_1;
        }
        if ($data->isInitialized('granularity')) {
            $dataArray['granularity'] = $data->getGranularity();
        }
        $dataArray['insightId'] = $data->getInsightId();
        $dataArray['key'] = $data->getKey();
        if ($data->isInitialized('limit')) {
            $dataArray['limit'] = $data->getLimit();
        }
        $value_2 = $data->getTimeRange();
        if (is_object($data->getTimeRange())) {
            $value_2 = $this->normalizer->normalize($data->getTimeRange(), 'json', $context);
        } elseif (is_object($data->getTimeRange())) {
            $value_2 = $this->normalizer->normalize($data->getTimeRange(), 'json', $context);
        }
        $dataArray['timeRange'] = $value_2;
        if ($data->isInitialized('timezone')) {
            $dataArray['timezone'] = $data->getTimezone();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class => false];
    }
}