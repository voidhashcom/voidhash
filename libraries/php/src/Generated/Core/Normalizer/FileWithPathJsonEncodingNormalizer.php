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
class FileWithPathJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\FileWithPathJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\FileWithPathJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\FileWithPathJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('parentId', $data) && $data['parentId'] !== null) {
            $object->setParentId($data['parentId']);
        }
        elseif (\array_key_exists('parentId', $data) && $data['parentId'] === null) {
            $object->setParentId(null);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('ownerBot', $data) && $data['ownerBot'] !== null) {
            $object->setOwnerBot($data['ownerBot']);
        }
        elseif (\array_key_exists('ownerBot', $data) && $data['ownerBot'] === null) {
            $object->setOwnerBot(null);
        }
        if (\array_key_exists('ownerUser', $data) && $data['ownerUser'] !== null) {
            $object->setOwnerUser($data['ownerUser']);
        }
        elseif (\array_key_exists('ownerUser', $data) && $data['ownerUser'] === null) {
            $object->setOwnerUser(null);
        }
        if (\array_key_exists('createdBy', $data)) {
            $object->setCreatedBy($data['createdBy']);
        }
        if (\array_key_exists('updatedBy', $data)) {
            $object->setUpdatedBy($data['updatedBy']);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('updatedAt', $data)) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        if (\array_key_exists('archivedAt', $data) && $data['archivedAt'] !== null) {
            $object->setArchivedAt($data['archivedAt']);
        }
        elseif (\array_key_exists('archivedAt', $data) && $data['archivedAt'] === null) {
            $object->setArchivedAt(null);
        }
        if (\array_key_exists('role', $data)) {
            $object->setRole($data['role']);
        }
        if (\array_key_exists('path', $data)) {
            $values = [];
            foreach ($data['path'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\FilePathEntryJsonEncoding::class, 'json', $context);
            }
            $object->setPath($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['parentId'] = $data->getParentId();
        $dataArray['kind'] = $data->getKind();
        $dataArray['name'] = $data->getName();
        $dataArray['ownerBot'] = $data->getOwnerBot();
        $dataArray['ownerUser'] = $data->getOwnerUser();
        $dataArray['createdBy'] = $data->getCreatedBy();
        $dataArray['updatedBy'] = $data->getUpdatedBy();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        $dataArray['archivedAt'] = $data->getArchivedAt();
        $dataArray['role'] = $data->getRole();
        $values = [];
        foreach ($data->getPath() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['path'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\FileWithPathJsonEncoding::class => false];
    }
}