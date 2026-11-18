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
class SchemaNativePropJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SchemaNativePropJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SchemaNativePropJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SchemaNativePropJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isWritable', $data) && \is_int($data['isWritable'])) {
            $data['isWritable'] = (bool) $data['isWritable'];
        }
        if (\array_key_exists('default', $data)) {
            $object->setDefault($data['default']);
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('isWritable', $data)) {
            $object->setIsWritable($data['isWritable']);
        }
        if (\array_key_exists('type', $data)) {
            $value = $data['type'];
            if (is_array($data['type']) and (\array_key_exists('kind', $data['type']) and ($data['type']['kind'] == 'string' or $data['type']['kind'] == 'number' or $data['type']['kind'] == 'boolean' or $data['type']['kind'] == 'product'))) {
                $value = $this->denormalizer->denormalize($data['type'], \Voidhash\Generated\Core\Model\SchemaNativeValueType::class, 'json', $context);
            } elseif (is_array($data['type']) and (\array_key_exists('kind', $data['type']) and $data['type']['kind'] == 'enum') and \array_key_exists('options', $data['type'])) {
                $value = $this->denormalizer->denormalize($data['type'], \Voidhash\Generated\Core\Model\SchemaNativeEnumType::class, 'json', $context);
            } elseif (is_array($data['type']) and (\array_key_exists('kind', $data['type']) and $data['type']['kind'] == 'list') and \array_key_exists('of', $data['type'])) {
                $value = $this->denormalizer->denormalize($data['type'], \Voidhash\Generated\Core\Model\SchemaNativeListType::class, 'json', $context);
            }
            $object->setType($value);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['default'] = $data->getDefault();
        $dataArray['key'] = $data->getKey();
        $dataArray['isWritable'] = $data->getIsWritable();
        $value = $data->getType();
        if (is_object($data->getType())) {
            $value = $this->normalizer->normalize($data->getType(), 'json', $context);
        } elseif (is_object($data->getType())) {
            $value = $this->normalizer->normalize($data->getType(), 'json', $context);
        } elseif (is_object($data->getType())) {
            $value = $this->normalizer->normalize($data->getType(), 'json', $context);
        }
        $dataArray['type'] = $value;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SchemaNativePropJsonEncoding::class => false];
    }
}