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
class AnalyticsChartCurvesResultSeriesItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResultSeriesItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResultSeriesItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResultSeriesItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('size', $data) && \is_int($data['size'])) {
            $data['size'] = (float) $data['size'];
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('label', $data) && $data['label'] !== null) {
            $object->setLabel($data['label']);
        }
        elseif (\array_key_exists('label', $data) && $data['label'] === null) {
            $object->setLabel(null);
        }
        if (\array_key_exists('size', $data)) {
            $object->setSize($data['size']);
        }
        if (\array_key_exists('values', $data)) {
            $values = [];
            foreach ($data['values'] as $value) {
                $values[] = $value;
            }
            $object->setValues($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['key'] = $data->getKey();
        $dataArray['label'] = $data->getLabel();
        $dataArray['size'] = $data->getSize();
        $values = [];
        foreach ($data->getValues() as $value) {
            $values[] = $value;
        }
        $dataArray['values'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartCurvesResultSeriesItem::class => false];
    }
}