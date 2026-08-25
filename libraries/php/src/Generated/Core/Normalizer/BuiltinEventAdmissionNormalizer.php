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
class BuiltinEventAdmissionNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\BuiltinEventAdmission::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\BuiltinEventAdmission::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\BuiltinEventAdmission();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('defaultEnabled', $data) && \is_int($data['defaultEnabled'])) {
            $data['defaultEnabled'] = (bool) $data['defaultEnabled'];
        }
        if (\array_key_exists('enabled', $data) && \is_int($data['enabled'])) {
            $data['enabled'] = (bool) $data['enabled'];
        }
        if (\array_key_exists('override', $data) && \is_int($data['override'])) {
            $data['override'] = (bool) $data['override'];
        }
        if (\array_key_exists('defaultEnabled', $data)) {
            $object->setDefaultEnabled($data['defaultEnabled']);
        }
        if (\array_key_exists('description', $data)) {
            $object->setDescription($data['description']);
        }
        if (\array_key_exists('enabled', $data)) {
            $object->setEnabled($data['enabled']);
        }
        if (\array_key_exists('eventNames', $data)) {
            $values = [];
            foreach ($data['eventNames'] as $value) {
                $values[] = $value;
            }
            $object->setEventNames($values);
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('override', $data) && $data['override'] !== null) {
            $object->setOverride($data['override']);
        }
        elseif (\array_key_exists('override', $data) && $data['override'] === null) {
            $object->setOverride(null);
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
        $dataArray['defaultEnabled'] = $data->getDefaultEnabled();
        $dataArray['description'] = $data->getDescription();
        $dataArray['enabled'] = $data->getEnabled();
        $values = [];
        foreach ($data->getEventNames() as $value) {
            $values[] = $value;
        }
        $dataArray['eventNames'] = $values;
        $dataArray['key'] = $data->getKey();
        $dataArray['name'] = $data->getName();
        $dataArray['override'] = $data->getOverride();
        $dataArray['warning'] = $data->getWarning();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\BuiltinEventAdmission::class => false];
    }
}