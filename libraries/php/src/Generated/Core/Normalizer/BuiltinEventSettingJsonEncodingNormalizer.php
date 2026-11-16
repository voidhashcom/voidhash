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
class BuiltinEventSettingJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isEnabled', $data) && \is_int($data['isEnabled'])) {
            $data['isEnabled'] = (bool) $data['isEnabled'];
        }
        if (\array_key_exists('isDefaultEnabled', $data) && \is_int($data['isDefaultEnabled'])) {
            $data['isDefaultEnabled'] = (bool) $data['isDefaultEnabled'];
        }
        if (\array_key_exists('isOverridden', $data) && \is_int($data['isOverridden'])) {
            $data['isOverridden'] = (bool) $data['isOverridden'];
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('description', $data)) {
            $object->setDescription($data['description']);
        }
        if (\array_key_exists('eventNames', $data)) {
            $values = [];
            foreach ($data['eventNames'] as $value) {
                $values[] = $value;
            }
            $object->setEventNames($values);
        }
        if (\array_key_exists('isEnabled', $data)) {
            $object->setIsEnabled($data['isEnabled']);
        }
        if (\array_key_exists('isDefaultEnabled', $data)) {
            $object->setIsDefaultEnabled($data['isDefaultEnabled']);
        }
        if (\array_key_exists('isOverridden', $data)) {
            $object->setIsOverridden($data['isOverridden']);
        }
        if (\array_key_exists('warning', $data) && $data['warning'] !== null) {
            $object->setWarning($data['warning']);
        }
        elseif (\array_key_exists('warning', $data) && $data['warning'] === null) {
            $object->setWarning(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['key'] = $data->getKey();
        $dataArray['name'] = $data->getName();
        $dataArray['description'] = $data->getDescription();
        $values = [];
        foreach ($data->getEventNames() as $value) {
            $values[] = $value;
        }
        $dataArray['eventNames'] = $values;
        $dataArray['isEnabled'] = $data->getIsEnabled();
        $dataArray['isDefaultEnabled'] = $data->getIsDefaultEnabled();
        $dataArray['isOverridden'] = $data->getIsOverridden();
        $dataArray['warning'] = $data->getWarning();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding::class => false];
    }
}