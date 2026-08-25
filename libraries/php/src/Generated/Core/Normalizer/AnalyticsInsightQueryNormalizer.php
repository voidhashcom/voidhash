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
        if (\array_key_exists('filter', $data)) {
            $value_1 = $data['filter'];
            if (is_array($data['filter']) and \array_key_exists('field', $data['filter']) and (\array_key_exists('op', $data['filter']) and ($data['filter']['op'] == 'eq' or $data['filter']['op'] == 'neq' or $data['filter']['op'] == 'in' or $data['filter']['op'] == 'not_in' or $data['filter']['op'] == 'gt' or $data['filter']['op'] == 'gte' or $data['filter']['op'] == 'lt' or $data['filter']['op'] == 'lte' or $data['filter']['op'] == 'contains' or $data['filter']['op'] == 'exists')) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'predicate')) {
                $value_1 = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class, 'json', $context);
            } elseif (is_array($data['filter'])) {
                $value_1 = $data['filter'];
            } elseif (is_array($data['filter'])) {
                $value_1 = $data['filter'];
            } elseif (is_array($data['filter'])) {
                $value_1 = $data['filter'];
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
            $object->setTimeRange($data['timeRange']);
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
        if ($data->isInitialized('filter') && null !== $data->getFilter()) {
            $value_1 = $data->getFilter();
            if (is_object($data->getFilter())) {
                $value_1 = $this->normalizer->normalize($data->getFilter(), 'json', $context);
            } elseif (is_object($data->getFilter())) {
                $value_1 = $data->getFilter();
            } elseif (is_object($data->getFilter())) {
                $value_1 = $data->getFilter();
            } elseif (is_object($data->getFilter())) {
                $value_1 = $data->getFilter();
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
        $dataArray['timeRange'] = $data->getTimeRange();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class => false];
    }
}