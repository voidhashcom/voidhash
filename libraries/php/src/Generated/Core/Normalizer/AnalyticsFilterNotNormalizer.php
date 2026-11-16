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
class AnalyticsFilterNotNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsFilterNot::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsFilterNot::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsFilterNot();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('filter', $data)) {
            $value = $data['filter'];
            if (is_array($data['filter']) and \array_key_exists('field', $data['filter']) and (\array_key_exists('op', $data['filter']) and ($data['filter']['op'] == 'eq' or $data['filter']['op'] == 'neq' or $data['filter']['op'] == 'in' or $data['filter']['op'] == 'not_in' or $data['filter']['op'] == 'gt' or $data['filter']['op'] == 'gte' or $data['filter']['op'] == 'lt' or $data['filter']['op'] == 'lte' or $data['filter']['op'] == 'contains' or $data['filter']['op'] == 'exists')) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'predicate')) {
                $value = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class, 'json', $context);
            } elseif (is_array($data['filter']) and \array_key_exists('filters', $data['filter']) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'and')) {
                $value = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterAnd::class, 'json', $context);
            } elseif (is_array($data['filter']) and \array_key_exists('filters', $data['filter']) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'or')) {
                $value = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterOr::class, 'json', $context);
            } elseif (is_array($data['filter']) and \array_key_exists('filter', $data['filter']) and (\array_key_exists('type', $data['filter']) and $data['filter']['type'] == 'not')) {
                $value = $this->denormalizer->denormalize($data['filter'], \Voidhash\Generated\Core\Model\AnalyticsFilterNot::class, 'json', $context);
            }
            $object->setFilter($value);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $value = $data->getFilter();
        if (is_object($data->getFilter())) {
            $value = $this->normalizer->normalize($data->getFilter(), 'json', $context);
        } elseif (is_object($data->getFilter())) {
            $value = $this->normalizer->normalize($data->getFilter(), 'json', $context);
        } elseif (is_object($data->getFilter())) {
            $value = $this->normalizer->normalize($data->getFilter(), 'json', $context);
        } elseif (is_object($data->getFilter())) {
            $value = $this->normalizer->normalize($data->getFilter(), 'json', $context);
        }
        $dataArray['filter'] = $value;
        $dataArray['type'] = $data->getType();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsFilterNot::class => false];
    }
}