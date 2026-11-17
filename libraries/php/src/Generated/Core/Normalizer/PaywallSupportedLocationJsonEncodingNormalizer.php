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
class PaywallSupportedLocationJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallSupportedLocationJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallSupportedLocationJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallSupportedLocationJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isArchived', $data) && \is_int($data['isArchived'])) {
            $data['isArchived'] = (bool) $data['isArchived'];
        }
        if (\array_key_exists('isInUse', $data) && \is_int($data['isInUse'])) {
            $data['isInUse'] = (bool) $data['isInUse'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('slug', $data)) {
            $object->setSlug($data['slug']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('position', $data)) {
            $object->setPosition($data['position']);
        }
        if (\array_key_exists('isArchived', $data)) {
            $object->setIsArchived($data['isArchived']);
        }
        if (\array_key_exists('isInUse', $data)) {
            $object->setIsInUse($data['isInUse']);
        }
        if (\array_key_exists('inUseReason', $data) && $data['inUseReason'] !== null) {
            $object->setInUseReason($data['inUseReason']);
        }
        elseif (\array_key_exists('inUseReason', $data) && $data['inUseReason'] === null) {
            $object->setInUseReason(null);
        }
        if (\array_key_exists('conflicts', $data)) {
            $values = [];
            foreach ($data['conflicts'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\LocationProblem::class, 'json', $context);
            }
            $object->setConflicts($values);
        }
        if (\array_key_exists('interface', $data)) {
            $object->setInterface($this->denormalizer->denormalize($data['interface'], \Voidhash\Generated\Core\Model\LocationInterface::class, 'json', $context));
        }
        if (\array_key_exists('addedAt', $data)) {
            $object->setAddedAt($data['addedAt']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['slug'] = $data->getSlug();
        $dataArray['name'] = $data->getName();
        $dataArray['position'] = $data->getPosition();
        $dataArray['isArchived'] = $data->getIsArchived();
        $dataArray['isInUse'] = $data->getIsInUse();
        $dataArray['inUseReason'] = $data->getInUseReason();
        $values = [];
        foreach ($data->getConflicts() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['conflicts'] = $values;
        $dataArray['interface'] = $this->normalizer->normalize($data->getInterface(), 'json', $context);
        $dataArray['addedAt'] = $data->getAddedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallSupportedLocationJsonEncoding::class => false];
    }
}