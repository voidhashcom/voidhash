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
class VoidQlSchemaResultJsonEncodingRelationsItemColumnsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isPersonalData', $data) && \is_int($data['isPersonalData'])) {
            $data['isPersonalData'] = (bool) $data['isPersonalData'];
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('description', $data)) {
            $object->setDescription($data['description']);
        }
        if (\array_key_exists('isPersonalData', $data)) {
            $object->setIsPersonalData($data['isPersonalData']);
        }
        if (\array_key_exists('references', $data) && $data['references'] !== null) {
            $object->setReferences($data['references']);
        }
        elseif (\array_key_exists('references', $data) && $data['references'] === null) {
            $object->setReferences(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['name'] = $data->getName();
        $dataArray['type'] = $data->getType();
        $dataArray['description'] = $data->getDescription();
        $dataArray['isPersonalData'] = $data->getIsPersonalData();
        $dataArray['references'] = $data->getReferences();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem::class => false];
    }
}