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
class NoticeJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\NoticeJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\NoticeJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\NoticeJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isUrgent', $data) && \is_int($data['isUrgent'])) {
            $data['isUrgent'] = (bool) $data['isUrgent'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('organizationId', $data)) {
            $object->setOrganizationId($data['organizationId']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('category', $data)) {
            $object->setCategory($data['category']);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('body', $data)) {
            $object->setBody($data['body']);
        }
        if (\array_key_exists('isUrgent', $data)) {
            $object->setIsUrgent($data['isUrgent']);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('readAt', $data) && $data['readAt'] !== null) {
            $object->setReadAt($data['readAt']);
        }
        elseif (\array_key_exists('readAt', $data) && $data['readAt'] === null) {
            $object->setReadAt(null);
        }
        if (\array_key_exists('archivedAt', $data) && $data['archivedAt'] !== null) {
            $object->setArchivedAt($data['archivedAt']);
        }
        elseif (\array_key_exists('archivedAt', $data) && $data['archivedAt'] === null) {
            $object->setArchivedAt(null);
        }
        if (\array_key_exists('resolvedAt', $data) && $data['resolvedAt'] !== null) {
            $object->setResolvedAt($data['resolvedAt']);
        }
        elseif (\array_key_exists('resolvedAt', $data) && $data['resolvedAt'] === null) {
            $object->setResolvedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['organizationId'] = $data->getOrganizationId();
        $dataArray['type'] = $data->getType();
        $dataArray['category'] = $data->getCategory();
        $dataArray['title'] = $data->getTitle();
        $dataArray['body'] = $data->getBody();
        $dataArray['isUrgent'] = $data->getIsUrgent();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['readAt'] = $data->getReadAt();
        $dataArray['archivedAt'] = $data->getArchivedAt();
        $dataArray['resolvedAt'] = $data->getResolvedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\NoticeJsonEncoding::class => false];
    }
}