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
class AnalyticsChartQueryNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartQuery::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartQuery::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartQuery();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasComparison', $data) && \is_int($data['hasComparison'])) {
            $data['hasComparison'] = (bool) $data['hasComparison'];
        }
        if (\array_key_exists('chartId', $data)) {
            $object->setChartId($data['chartId']);
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('timeRange', $data)) {
            $value = $data['timeRange'];
            if (is_array($data['timeRange']) and (\array_key_exists('preset', $data['timeRange']) and ($data['timeRange']['preset'] == 'today' or $data['timeRange']['preset'] == 'last_7d' or $data['timeRange']['preset'] == 'last_30d' or $data['timeRange']['preset'] == 'last_90d' or $data['timeRange']['preset'] == 'last_365d' or $data['timeRange']['preset'] == 'mtd' or $data['timeRange']['preset'] == 'qtd' or $data['timeRange']['preset'] == 'ytd'))) {
                $value = $this->denormalizer->denormalize($data['timeRange'], \Voidhash\Generated\Core\Model\AnalyticsPresetTimeRange::class, 'json', $context);
            } elseif (is_array($data['timeRange']) and \array_key_exists('end', $data['timeRange']) and (\array_key_exists('preset', $data['timeRange']) and $data['timeRange']['preset'] == 'custom') and \array_key_exists('start', $data['timeRange'])) {
                $value = $this->denormalizer->denormalize($data['timeRange'], \Voidhash\Generated\Core\Model\AnalyticsCustomTimeRange::class, 'json', $context);
            }
            $object->setTimeRange($value);
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
        if (\array_key_exists('hasComparison', $data) && $data['hasComparison'] !== null) {
            $object->setHasComparison($data['hasComparison']);
        }
        elseif (\array_key_exists('hasComparison', $data) && $data['hasComparison'] === null) {
            $object->setHasComparison(null);
        }
        if (\array_key_exists('filters', $data)) {
            $object->setFilters($this->denormalizer->denormalize($data['filters'], \Voidhash\Generated\Core\Model\AnalyticsChartFilters::class, 'json', $context));
        }
        if (\array_key_exists('options', $data)) {
            $object->setOptions($this->denormalizer->denormalize($data['options'], \Voidhash\Generated\Core\Model\AnalyticsChartOptions::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['chartId'] = $data->getChartId();
        $dataArray['key'] = $data->getKey();
        $value = $data->getTimeRange();
        if (is_object($data->getTimeRange())) {
            $value = $this->normalizer->normalize($data->getTimeRange(), 'json', $context);
        } elseif (is_object($data->getTimeRange())) {
            $value = $this->normalizer->normalize($data->getTimeRange(), 'json', $context);
        }
        $dataArray['timeRange'] = $value;
        if ($data->isInitialized('granularity')) {
            $dataArray['granularity'] = $data->getGranularity();
        }
        if ($data->isInitialized('timezone')) {
            $dataArray['timezone'] = $data->getTimezone();
        }
        if ($data->isInitialized('hasComparison')) {
            $dataArray['hasComparison'] = $data->getHasComparison();
        }
        if ($data->isInitialized('filters') && null !== $data->getFilters()) {
            $dataArray['filters'] = $this->normalizer->normalize($data->getFilters(), 'json', $context);
        }
        if ($data->isInitialized('options') && null !== $data->getOptions()) {
            $dataArray['options'] = $this->normalizer->normalize($data->getOptions(), 'json', $context);
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartQuery::class => false];
    }
}