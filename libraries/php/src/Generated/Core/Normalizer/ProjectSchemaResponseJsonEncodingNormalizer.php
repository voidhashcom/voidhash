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
class ProjectSchemaResponseJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('enabledProviders', $data)) {
            $values = [];
            foreach ($data['enabledProviders'] as $value) {
                $values[] = $value;
            }
            $object->setEnabledProviders($values);
        }
        if (\array_key_exists('locations', $data)) {
            $values_1 = [];
            foreach ($data['locations'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\SchemaLocationJsonEncoding::class, 'json', $context);
            }
            $object->setLocations($values_1);
        }
        if (\array_key_exists('perks', $data)) {
            $values_2 = [];
            foreach ($data['perks'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\SchemaPerkJsonEncoding::class, 'json', $context);
            }
            $object->setPerks($values_2);
        }
        if (\array_key_exists('products', $data)) {
            $values_3 = [];
            foreach ($data['products'] as $value_3) {
                $values_3[] = $this->denormalizer->denormalize($value_3, \Voidhash\Generated\Core\Model\SchemaProductJsonEncoding::class, 'json', $context);
            }
            $object->setProducts($values_3);
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
        foreach ($data->getEnabledProviders() as $value) {
            $values[] = $value;
        }
        $dataArray['enabledProviders'] = $values;
        $values_1 = [];
        foreach ($data->getLocations() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['locations'] = $values_1;
        $values_2 = [];
        foreach ($data->getPerks() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['perks'] = $values_2;
        $values_3 = [];
        foreach ($data->getProducts() as $value_3) {
            $values_3[] = $this->normalizer->normalize($value_3, 'json', $context);
        }
        $dataArray['products'] = $values_3;
        $dataArray['version'] = $data->getVersion();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class => false];
    }
}