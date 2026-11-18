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
class SchemaNativeListTypeNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SchemaNativeListType::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SchemaNativeListType::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SchemaNativeListType();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('of', $data)) {
            $value = $data['of'];
            if (is_array($data['of']) and (\array_key_exists('kind', $data['of']) and ($data['of']['kind'] == 'string' or $data['of']['kind'] == 'number' or $data['of']['kind'] == 'boolean' or $data['of']['kind'] == 'product'))) {
                $value = $this->denormalizer->denormalize($data['of'], \Voidhash\Generated\Core\Model\SchemaNativeValueType::class, 'json', $context);
            } elseif (is_array($data['of']) and (\array_key_exists('kind', $data['of']) and $data['of']['kind'] == 'enum') and \array_key_exists('options', $data['of'])) {
                $value = $this->denormalizer->denormalize($data['of'], \Voidhash\Generated\Core\Model\SchemaNativeEnumType::class, 'json', $context);
            }
            $object->setOf($value);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['kind'] = $data->getKind();
        $value = $data->getOf();
        if (is_object($data->getOf())) {
            $value = $this->normalizer->normalize($data->getOf(), 'json', $context);
        } elseif (is_object($data->getOf())) {
            $value = $this->normalizer->normalize($data->getOf(), 'json', $context);
        }
        $dataArray['of'] = $value;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SchemaNativeListType::class => false];
    }
}