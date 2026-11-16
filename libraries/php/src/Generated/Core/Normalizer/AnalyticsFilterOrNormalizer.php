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
class AnalyticsFilterOrNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsFilterOr::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsFilterOr::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsFilterOr();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('filters', $data)) {
            $values = [];
            foreach ($data['filters'] as $value) {
                $value_1 = $value;
                if (is_array($value) and \array_key_exists('field', $value) and (\array_key_exists('op', $value) and ($value['op'] == 'eq' or $value['op'] == 'neq' or $value['op'] == 'in' or $value['op'] == 'not_in' or $value['op'] == 'gt' or $value['op'] == 'gte' or $value['op'] == 'lt' or $value['op'] == 'lte' or $value['op'] == 'contains' or $value['op'] == 'exists')) and (\array_key_exists('type', $value) and $value['type'] == 'predicate')) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class, 'json', $context);
                } elseif (is_array($value) and \array_key_exists('filters', $value) and (\array_key_exists('type', $value) and $value['type'] == 'and')) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsFilterAnd::class, 'json', $context);
                } elseif (is_array($value) and \array_key_exists('filters', $value) and (\array_key_exists('type', $value) and $value['type'] == 'or')) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsFilterOr::class, 'json', $context);
                } elseif (is_array($value) and \array_key_exists('filter', $value) and (\array_key_exists('type', $value) and $value['type'] == 'not')) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsFilterNot::class, 'json', $context);
                }
                $values[] = $value_1;
            }
            $object->setFilters($values);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $values = [];
        foreach ($data->getFilters() as $value) {
            $value_1 = $value;
            if (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            }
            $values[] = $value_1;
        }
        $dataArray['filters'] = $values;
        $dataArray['type'] = $data->getType();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsFilterOr::class => false];
    }
}