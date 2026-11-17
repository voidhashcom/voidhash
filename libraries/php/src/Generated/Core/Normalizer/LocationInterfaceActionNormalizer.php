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
class LocationInterfaceActionNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\LocationInterfaceAction::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\LocationInterfaceAction::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\LocationInterfaceAction();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isDeprecated', $data) && \is_int($data['isDeprecated'])) {
            $data['isDeprecated'] = (bool) $data['isDeprecated'];
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('addedIn', $data)) {
            $object->setAddedIn($data['addedIn']);
        }
        if (\array_key_exists('isDeprecated', $data) && $data['isDeprecated'] !== null) {
            $object->setIsDeprecated($data['isDeprecated']);
        }
        elseif (\array_key_exists('isDeprecated', $data) && $data['isDeprecated'] === null) {
            $object->setIsDeprecated(null);
        }
        if (\array_key_exists('args', $data)) {
            $values = [];
            foreach ($data['args'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\LocationInterfaceSignatureField::class, 'json', $context);
            }
            $object->setArgs($values);
        }
        if (\array_key_exists('reply', $data)) {
            $values_1 = [];
            foreach ($data['reply'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\LocationInterfaceSignatureField::class, 'json', $context);
            }
            $object->setReply($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['name'] = $data->getName();
        $dataArray['addedIn'] = $data->getAddedIn();
        if ($data->isInitialized('isDeprecated')) {
            $dataArray['isDeprecated'] = $data->getIsDeprecated();
        }
        $values = [];
        foreach ($data->getArgs() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['args'] = $values;
        $values_1 = [];
        foreach ($data->getReply() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['reply'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\LocationInterfaceAction::class => false];
    }
}