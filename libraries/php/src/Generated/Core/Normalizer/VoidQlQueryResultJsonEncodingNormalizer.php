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
class VoidQlQueryResultJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isTruncated', $data) && \is_int($data['isTruncated'])) {
            $data['isTruncated'] = (bool) $data['isTruncated'];
        }
        if (\array_key_exists('columns', $data)) {
            $values = [];
            foreach ($data['columns'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncodingColumnsItem::class, 'json', $context);
            }
            $object->setColumns($values);
        }
        if (\array_key_exists('rows', $data)) {
            $values_1 = [];
            foreach ($data['rows'] as $value_1) {
                $values_2 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
                foreach ($value_1 as $key => $value_2) {
                    $values_2[$key] = $value_2;
                }
                $values_1[] = $values_2;
            }
            $object->setRows($values_1);
        }
        if (\array_key_exists('isTruncated', $data)) {
            $object->setIsTruncated($data['isTruncated']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $values = [];
        foreach ($data->getColumns() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['columns'] = $values;
        $values_1 = [];
        foreach ($data->getRows() as $value_1) {
            $values_2 = [];
            foreach ($value_1 as $key => $value_2) {
                $values_2[$key] = $value_2;
            }
            $values_1[] = $values_2;
        }
        $dataArray['rows'] = $values_1;
        $dataArray['isTruncated'] = $data->getIsTruncated();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding::class => false];
    }
}