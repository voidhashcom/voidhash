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
class SdkSchemaJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('locations', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['locations'] as $key => $value) {
                $values[$key] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\SdkSchemaLocationJsonEncoding::class, 'json', $context);
            }
            $object->setLocations($values);
        }
        if (\array_key_exists('perks', $data)) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['perks'] as $key_1 => $value_1) {
                $values_1[$key_1] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\SdkSchemaPerkJsonEncoding::class, 'json', $context);
            }
            $object->setPerks($values_1);
        }
        if (\array_key_exists('products', $data)) {
            $values_2 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['products'] as $key_2 => $value_2) {
                $values_2[$key_2] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncoding::class, 'json', $context);
            }
            $object->setProducts($values_2);
        }
        if (\array_key_exists('version', $data)) {
            $object->setVersion($data['version']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $values = [];
        foreach ($data->getLocations() as $key => $value) {
            $values[$key] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['locations'] = $values;
        $values_1 = [];
        foreach ($data->getPerks() as $key_1 => $value_1) {
            $values_1[$key_1] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['perks'] = $values_1;
        $values_2 = [];
        foreach ($data->getProducts() as $key_2 => $value_2) {
            $values_2[$key_2] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['products'] = $values_2;
        $dataArray['version'] = $data->getVersion();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding::class => false];
    }
}