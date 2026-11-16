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
class FeatureFlagJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding();
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
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('environments', $data)) {
            $object->setEnvironments($this->denormalizer->denormalize($data['environments'], \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentsJsonEncoding::class, 'json', $context));
        }
        if (\array_key_exists('isArchived', $data)) {
            $object->setIsArchived($data['isArchived']);
        }
        if (\array_key_exists('experimentId', $data) && $data['experimentId'] !== null) {
            $object->setExperimentId($data['experimentId']);
        }
        elseif (\array_key_exists('experimentId', $data) && $data['experimentId'] === null) {
            $object->setExperimentId(null);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('updatedAt', $data) && $data['updatedAt'] !== null) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        elseif (\array_key_exists('updatedAt', $data) && $data['updatedAt'] === null) {
            $object->setUpdatedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['key'] = $data->getKey();
        $dataArray['description'] = $data->getDescription();
        $dataArray['type'] = $data->getType();
        $dataArray['environments'] = $this->normalizer->normalize($data->getEnvironments(), 'json', $context);
        $dataArray['isArchived'] = $data->getIsArchived();
        $dataArray['experimentId'] = $data->getExperimentId();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding::class => false];
    }
}