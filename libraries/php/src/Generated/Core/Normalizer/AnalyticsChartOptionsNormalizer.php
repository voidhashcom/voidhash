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
class AnalyticsChartOptionsNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartOptions::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartOptions::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartOptions();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('dimension', $data) && $data['dimension'] !== null) {
            $object->setDimension($data['dimension']);
        }
        elseif (\array_key_exists('dimension', $data) && $data['dimension'] === null) {
            $object->setDimension(null);
        }
        if (\array_key_exists('eventName', $data) && $data['eventName'] !== null) {
            $object->setEventName($data['eventName']);
        }
        elseif (\array_key_exists('eventName', $data) && $data['eventName'] === null) {
            $object->setEventName(null);
        }
        if (\array_key_exists('experimentId', $data) && $data['experimentId'] !== null) {
            $object->setExperimentId($data['experimentId']);
        }
        elseif (\array_key_exists('experimentId', $data) && $data['experimentId'] === null) {
            $object->setExperimentId(null);
        }
        if (\array_key_exists('limit', $data) && $data['limit'] !== null) {
            $object->setLimit($data['limit']);
        }
        elseif (\array_key_exists('limit', $data) && $data['limit'] === null) {
            $object->setLimit(null);
        }
        if (\array_key_exists('metric', $data) && $data['metric'] !== null) {
            $object->setMetric($data['metric']);
        }
        elseif (\array_key_exists('metric', $data) && $data['metric'] === null) {
            $object->setMetric(null);
        }
        if (\array_key_exists('period', $data) && $data['period'] !== null) {
            $object->setPeriod($data['period']);
        }
        elseif (\array_key_exists('period', $data) && $data['period'] === null) {
            $object->setPeriod(null);
        }
        if (\array_key_exists('placementId', $data) && $data['placementId'] !== null) {
            $object->setPlacementId($data['placementId']);
        }
        elseif (\array_key_exists('placementId', $data) && $data['placementId'] === null) {
            $object->setPlacementId(null);
        }
        if (\array_key_exists('returnEventName', $data) && $data['returnEventName'] !== null) {
            $object->setReturnEventName($data['returnEventName']);
        }
        elseif (\array_key_exists('returnEventName', $data) && $data['returnEventName'] === null) {
            $object->setReturnEventName(null);
        }
        if (\array_key_exists('trait', $data) && $data['trait'] !== null) {
            $object->setTrait($data['trait']);
        }
        elseif (\array_key_exists('trait', $data) && $data['trait'] === null) {
            $object->setTrait(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('dimension')) {
            $dataArray['dimension'] = $data->getDimension();
        }
        if ($data->isInitialized('eventName')) {
            $dataArray['eventName'] = $data->getEventName();
        }
        if ($data->isInitialized('experimentId')) {
            $dataArray['experimentId'] = $data->getExperimentId();
        }
        if ($data->isInitialized('limit')) {
            $dataArray['limit'] = $data->getLimit();
        }
        if ($data->isInitialized('metric')) {
            $dataArray['metric'] = $data->getMetric();
        }
        if ($data->isInitialized('period')) {
            $dataArray['period'] = $data->getPeriod();
        }
        if ($data->isInitialized('placementId')) {
            $dataArray['placementId'] = $data->getPlacementId();
        }
        if ($data->isInitialized('returnEventName')) {
            $dataArray['returnEventName'] = $data->getReturnEventName();
        }
        if ($data->isInitialized('trait')) {
            $dataArray['trait'] = $data->getTrait();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartOptions::class => false];
    }
}