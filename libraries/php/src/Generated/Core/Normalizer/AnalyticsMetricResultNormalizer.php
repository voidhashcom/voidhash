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
class AnalyticsMetricResultNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsMetricResult::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsMetricResult::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsMetricResult();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isWithheld', $data) && \is_int($data['isWithheld'])) {
            $data['isWithheld'] = (bool) $data['isWithheld'];
        }
        if (\array_key_exists('hasOverlappingGroups', $data) && \is_int($data['hasOverlappingGroups'])) {
            $data['hasOverlappingGroups'] = (bool) $data['hasOverlappingGroups'];
        }
        if (\array_key_exists('unit', $data)) {
            $object->setUnit($data['unit']);
        }
        if (\array_key_exists('buckets', $data)) {
            $values = [];
            foreach ($data['buckets'] as $value) {
                $values[] = $value;
            }
            $object->setBuckets($values);
        }
        if (\array_key_exists('total', $data)) {
            $values_1 = [];
            foreach ($data['total'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setTotal($values_1);
        }
        if (\array_key_exists('previousTotal', $data) && $data['previousTotal'] !== null) {
            $values_2 = [];
            foreach ($data['previousTotal'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setPreviousTotal($values_2);
        }
        elseif (\array_key_exists('previousTotal', $data) && $data['previousTotal'] === null) {
            $object->setPreviousTotal(null);
        }
        if (\array_key_exists('series', $data)) {
            $values_3 = [];
            foreach ($data['series'] as $value_3) {
                $values_3[] = $this->denormalizer->denormalize($value_3, \Voidhash\Generated\Core\Model\AnalyticsMetricResultSeriesItem::class, 'json', $context);
            }
            $object->setSeries($values_3);
        }
        if (\array_key_exists('margins', $data) && $data['margins'] !== null) {
            $object->setMargins($this->denormalizer->denormalize($data['margins'], \Voidhash\Generated\Core\Model\AnalyticsMetricResultMargins::class, 'json', $context));
        }
        elseif (\array_key_exists('margins', $data) && $data['margins'] === null) {
            $object->setMargins(null);
        }
        if (\array_key_exists('isWithheld', $data)) {
            $object->setIsWithheld($data['isWithheld']);
        }
        if (\array_key_exists('hasOverlappingGroups', $data)) {
            $object->setHasOverlappingGroups($data['hasOverlappingGroups']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['unit'] = $data->getUnit();
        $values = [];
        foreach ($data->getBuckets() as $value) {
            $values[] = $value;
        }
        $dataArray['buckets'] = $values;
        $values_1 = [];
        foreach ($data->getTotal() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['total'] = $values_1;
        if ($data->isInitialized('previousTotal')) {
            $values_2 = [];
            foreach ($data->getPreviousTotal() as $value_2) {
                $values_2[] = $value_2;
            }
            $dataArray['previousTotal'] = $values_2;
        }
        $values_3 = [];
        foreach ($data->getSeries() as $value_3) {
            $values_3[] = $this->normalizer->normalize($value_3, 'json', $context);
        }
        $dataArray['series'] = $values_3;
        if ($data->isInitialized('margins')) {
            $dataArray['margins'] = $this->normalizer->normalize($data->getMargins(), 'json', $context);
        }
        $dataArray['isWithheld'] = $data->getIsWithheld();
        $dataArray['hasOverlappingGroups'] = $data->getHasOverlappingGroups();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsMetricResult::class => false];
    }
}