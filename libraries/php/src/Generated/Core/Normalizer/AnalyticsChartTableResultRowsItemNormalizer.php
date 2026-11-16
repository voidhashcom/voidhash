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
class AnalyticsChartTableResultRowsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartTableResultRowsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartTableResultRowsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartTableResultRowsItem();
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
        if (\array_key_exists('label', $data) && $data['label'] !== null) {
            $object->setLabel($data['label']);
        }
        elseif (\array_key_exists('label', $data) && $data['label'] === null) {
            $object->setLabel(null);
        }
        if (\array_key_exists('values', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['values'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setValues($values);
        }
        if (\array_key_exists('text', $data) && $data['text'] !== null) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['text'] as $key_1 => $value_1) {
                $values_1[$key_1] = $value_1;
            }
            $object->setText($values_1);
        }
        elseif (\array_key_exists('text', $data) && $data['text'] === null) {
            $object->setText(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['key'] = $data->getKey();
        $dataArray['label'] = $data->getLabel();
        $values = [];
        foreach ($data->getValues() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['values'] = $values;
        if ($data->isInitialized('text')) {
            $values_1 = [];
            foreach ($data->getText() as $key_1 => $value_1) {
                $values_1[$key_1] = $value_1;
            }
            $dataArray['text'] = $values_1;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartTableResultRowsItem::class => false];
    }
}