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
class AnalyticsChartHeatmapResultNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartHeatmapResult::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartHeatmapResult::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartHeatmapResult();
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
        if (\array_key_exists('rows', $data)) {
            $values = [];
            foreach ($data['rows'] as $value) {
                $values[] = $value;
            }
            $object->setRows($values);
        }
        if (\array_key_exists('columns', $data)) {
            $values_1 = [];
            foreach ($data['columns'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setColumns($values_1);
        }
        if (\array_key_exists('values', $data)) {
            $values_2 = [];
            foreach ($data['values'] as $value_2) {
                $values_3 = [];
                foreach ($value_2 as $value_3) {
                    $values_3[] = $value_3;
                }
                $values_2[] = $values_3;
            }
            $object->setValues($values_2);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['shape'] = $data->getShape();
        $dataArray['unit'] = $data->getUnit();
        $values = [];
        foreach ($data->getRows() as $value) {
            $values[] = $value;
        }
        $dataArray['rows'] = $values;
        $values_1 = [];
        foreach ($data->getColumns() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['columns'] = $values_1;
        $values_2 = [];
        foreach ($data->getValues() as $value_2) {
            $values_3 = [];
            foreach ($value_2 as $value_3) {
                $values_3[] = $value_3;
            }
            $values_2[] = $values_3;
        }
        $dataArray['values'] = $values_2;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartHeatmapResult::class => false];
    }
}