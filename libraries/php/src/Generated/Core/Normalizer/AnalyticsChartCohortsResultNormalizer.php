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
class AnalyticsChartCohortsResultNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResult::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResult::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResult();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('shape', $data)) {
            $object->setShape($data['shape']);
        }
        if (\array_key_exists('unit', $data)) {
            $object->setUnit($data['unit']);
        }
        if (\array_key_exists('period', $data)) {
            $object->setPeriod($data['period']);
        }
        if (\array_key_exists('offsets', $data)) {
            $values = [];
            foreach ($data['offsets'] as $value) {
                $values[] = $value;
            }
            $object->setOffsets($values);
        }
        if (\array_key_exists('cohorts', $data)) {
            $values_1 = [];
            foreach ($data['cohorts'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResultCohortsItem::class, 'json', $context);
            }
            $object->setCohorts($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['shape'] = $data->getShape();
        $dataArray['unit'] = $data->getUnit();
        $dataArray['period'] = $data->getPeriod();
        $values = [];
        foreach ($data->getOffsets() as $value) {
            $values[] = $value;
        }
        $dataArray['offsets'] = $values;
        $values_1 = [];
        foreach ($data->getCohorts() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['cohorts'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartCohortsResult::class => false];
    }
}