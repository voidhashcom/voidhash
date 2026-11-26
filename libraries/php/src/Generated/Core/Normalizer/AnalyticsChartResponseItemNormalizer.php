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
class AnalyticsChartResponseItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartResponseItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartResponseItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartResponseItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('chartId', $data)) {
            $object->setChartId($data['chartId']);
        }
        if (\array_key_exists('resolvedTimeRange', $data)) {
            $object->setResolvedTimeRange($this->denormalizer->denormalize($data['resolvedTimeRange'], \Voidhash\Generated\Core\Model\AnalyticsChartResponseItemResolvedTimeRange::class, 'json', $context));
        }
        if (\array_key_exists('currency', $data) && $data['currency'] !== null) {
            $object->setCurrency($data['currency']);
        }
        elseif (\array_key_exists('currency', $data) && $data['currency'] === null) {
            $object->setCurrency(null);
        }
        if (\array_key_exists('result', $data)) {
            $value = $data['result'];
            if (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'series') and (\array_key_exists('unit', $data['result']) and ($data['result']['unit'] == 'count' or $data['result']['unit'] == 'money' or $data['result']['unit'] == 'rate' or $data['result']['unit'] == 'ratio' or $data['result']['unit'] == 'milliseconds' or $data['result']['unit'] == 'seconds' or $data['result']['unit'] == 'minutes' or $data['result']['unit'] == 'days' or $data['result']['unit'] == 'score')) and \array_key_exists('buckets', $data['result']) and \array_key_exists('series', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartSeriesResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'table') and \array_key_exists('columns', $data['result']) and \array_key_exists('rows', $data['result']) and \array_key_exists('isTruncated', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartTableResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'funnel') and \array_key_exists('steps', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartFunnelResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'cohorts') and (\array_key_exists('unit', $data['result']) and ($data['result']['unit'] == 'count' or $data['result']['unit'] == 'money' or $data['result']['unit'] == 'rate' or $data['result']['unit'] == 'ratio' or $data['result']['unit'] == 'milliseconds' or $data['result']['unit'] == 'seconds' or $data['result']['unit'] == 'minutes' or $data['result']['unit'] == 'days' or $data['result']['unit'] == 'score')) and (\array_key_exists('period', $data['result']) and ($data['result']['period'] == 'day' or $data['result']['period'] == 'week' or $data['result']['period'] == 'month')) and \array_key_exists('offsets', $data['result']) and \array_key_exists('cohorts', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'curves') and (\array_key_exists('unit', $data['result']) and ($data['result']['unit'] == 'count' or $data['result']['unit'] == 'money' or $data['result']['unit'] == 'rate' or $data['result']['unit'] == 'ratio' or $data['result']['unit'] == 'milliseconds' or $data['result']['unit'] == 'seconds' or $data['result']['unit'] == 'minutes' or $data['result']['unit'] == 'days' or $data['result']['unit'] == 'score')) and (\array_key_exists('axis', $data['result']) and ($data['result']['axis'] == 'day' or $data['result']['axis'] == 'week' or $data['result']['axis'] == 'month')) and \array_key_exists('offsets', $data['result']) and \array_key_exists('series', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'histogram') and (\array_key_exists('unit', $data['result']) and ($data['result']['unit'] == 'count' or $data['result']['unit'] == 'money' or $data['result']['unit'] == 'rate' or $data['result']['unit'] == 'ratio' or $data['result']['unit'] == 'milliseconds' or $data['result']['unit'] == 'seconds' or $data['result']['unit'] == 'minutes' or $data['result']['unit'] == 'days' or $data['result']['unit'] == 'score')) and \array_key_exists('bins', $data['result']) and \array_key_exists('median', $data['result']) and \array_key_exists('total', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'heatmap') and (\array_key_exists('unit', $data['result']) and ($data['result']['unit'] == 'count' or $data['result']['unit'] == 'money' or $data['result']['unit'] == 'rate' or $data['result']['unit'] == 'ratio' or $data['result']['unit'] == 'milliseconds' or $data['result']['unit'] == 'seconds' or $data['result']['unit'] == 'minutes' or $data['result']['unit'] == 'days' or $data['result']['unit'] == 'score')) and \array_key_exists('rows', $data['result']) and \array_key_exists('columns', $data['result']) and \array_key_exists('values', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartHeatmapResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'flow') and \array_key_exists('nodes', $data['result']) and \array_key_exists('links', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartFlowResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'stats') and \array_key_exists('stats', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartStatsResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'points') and (\array_key_exists('unit', $data['result']) and ($data['result']['unit'] == 'count' or $data['result']['unit'] == 'money' or $data['result']['unit'] == 'rate' or $data['result']['unit'] == 'ratio' or $data['result']['unit'] == 'milliseconds' or $data['result']['unit'] == 'seconds' or $data['result']['unit'] == 'minutes' or $data['result']['unit'] == 'days' or $data['result']['unit'] == 'score')) and \array_key_exists('points', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartPointsResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'markers') and \array_key_exists('markers', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartMarkersResult::class, 'json', $context);
            } elseif (is_array($data['result']) and (\array_key_exists('shape', $data['result']) and $data['result']['shape'] == 'options') and \array_key_exists('platforms', $data['result']) and \array_key_exists('countries', $data['result']) and \array_key_exists('appVersions', $data['result']) and \array_key_exists('products', $data['result']) and \array_key_exists('stores', $data['result']) and \array_key_exists('packageSources', $data['result']) and \array_key_exists('placements', $data['result']) and \array_key_exists('paywalls', $data['result']) and \array_key_exists('offers', $data['result']) and \array_key_exists('acquisitionSources', $data['result']) and \array_key_exists('experiments', $data['result']) and \array_key_exists('events', $data['result']) and \array_key_exists('traits', $data['result']) and \array_key_exists('properties', $data['result'])) {
                $value = $this->denormalizer->denormalize($data['result'], \Voidhash\Generated\Core\Model\AnalyticsChartOptionsResult::class, 'json', $context);
            }
            $object->setResult($value);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['key'] = $data->getKey();
        $dataArray['chartId'] = $data->getChartId();
        $dataArray['resolvedTimeRange'] = $this->normalizer->normalize($data->getResolvedTimeRange(), 'json', $context);
        $dataArray['currency'] = $data->getCurrency();
        $value = $data->getResult();
        if (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        } elseif (is_object($data->getResult())) {
            $value = $this->normalizer->normalize($data->getResult(), 'json', $context);
        }
        $dataArray['result'] = $value;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartResponseItem::class => false];
    }
}