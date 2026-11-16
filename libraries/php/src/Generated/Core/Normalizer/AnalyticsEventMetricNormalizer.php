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
class AnalyticsEventMetricNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsEventMetric::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsEventMetric::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsEventMetric();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('eventName', $data)) {
            $object->setEventName($data['eventName']);
        }
        if (\array_key_exists('aggregation', $data)) {
            $object->setAggregation($data['aggregation']);
        }
        if (\array_key_exists('statistic', $data) && $data['statistic'] !== null) {
            $object->setStatistic($data['statistic']);
        }
        elseif (\array_key_exists('statistic', $data) && $data['statistic'] === null) {
            $object->setStatistic(null);
        }
        if (\array_key_exists('property', $data) && $data['property'] !== null) {
            $object->setProperty($data['property']);
        }
        elseif (\array_key_exists('property', $data) && $data['property'] === null) {
            $object->setProperty(null);
        }
        if (\array_key_exists('groupType', $data) && $data['groupType'] !== null) {
            $object->setGroupType($data['groupType']);
        }
        elseif (\array_key_exists('groupType', $data) && $data['groupType'] === null) {
            $object->setGroupType(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['kind'] = $data->getKind();
        $dataArray['eventName'] = $data->getEventName();
        $dataArray['aggregation'] = $data->getAggregation();
        if ($data->isInitialized('statistic')) {
            $dataArray['statistic'] = $data->getStatistic();
        }
        if ($data->isInitialized('property')) {
            $dataArray['property'] = $data->getProperty();
        }
        if ($data->isInitialized('groupType')) {
            $dataArray['groupType'] = $data->getGroupType();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsEventMetric::class => false];
    }
}