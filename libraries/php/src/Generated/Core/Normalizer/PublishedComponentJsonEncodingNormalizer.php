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
class PublishedComponentJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding();
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
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('organizationId', $data)) {
            $object->setOrganizationId($data['organizationId']);
        }
        if (\array_key_exists('slug', $data)) {
            $object->setSlug($data['slug']);
        }
        if (\array_key_exists('publisher', $data)) {
            $object->setPublisher($data['publisher']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('description', $data)) {
            $object->setDescription($data['description']);
        }
        if (\array_key_exists('category', $data)) {
            $object->setCategory($data['category']);
        }
        if (\array_key_exists('keywords', $data)) {
            $values = [];
            foreach ($data['keywords'] as $value) {
                $values[] = $value;
            }
            $object->setKeywords($values);
        }
        if (\array_key_exists('isDeprecated', $data)) {
            $object->setIsDeprecated($data['isDeprecated']);
        }
        if (\array_key_exists('deprecatedAt', $data) && $data['deprecatedAt'] !== null) {
            $object->setDeprecatedAt($data['deprecatedAt']);
        }
        elseif (\array_key_exists('deprecatedAt', $data) && $data['deprecatedAt'] === null) {
            $object->setDeprecatedAt(null);
        }
        if (\array_key_exists('deprecationMessage', $data) && $data['deprecationMessage'] !== null) {
            $object->setDeprecationMessage($data['deprecationMessage']);
        }
        elseif (\array_key_exists('deprecationMessage', $data) && $data['deprecationMessage'] === null) {
            $object->setDeprecationMessage(null);
        }
        if (\array_key_exists('ownerProjectId', $data) && $data['ownerProjectId'] !== null) {
            $object->setOwnerProjectId($data['ownerProjectId']);
        }
        elseif (\array_key_exists('ownerProjectId', $data) && $data['ownerProjectId'] === null) {
            $object->setOwnerProjectId(null);
        }
        if (\array_key_exists('latestVersionId', $data) && $data['latestVersionId'] !== null) {
            $object->setLatestVersionId($data['latestVersionId']);
        }
        elseif (\array_key_exists('latestVersionId', $data) && $data['latestVersionId'] === null) {
            $object->setLatestVersionId(null);
        }
        if (\array_key_exists('latestVersion', $data) && $data['latestVersion'] !== null) {
            $object->setLatestVersion($data['latestVersion']);
        }
        elseif (\array_key_exists('latestVersion', $data) && $data['latestVersion'] === null) {
            $object->setLatestVersion(null);
        }
        if (\array_key_exists('versionCount', $data)) {
            $object->setVersionCount($data['versionCount']);
        }
        if (\array_key_exists('installId', $data) && $data['installId'] !== null) {
            $object->setInstallId($data['installId']);
        }
        elseif (\array_key_exists('installId', $data) && $data['installId'] === null) {
            $object->setInstallId(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('updatedAt', $data)) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['organizationId'] = $data->getOrganizationId();
        $dataArray['slug'] = $data->getSlug();
        $dataArray['publisher'] = $data->getPublisher();
        $dataArray['name'] = $data->getName();
        $dataArray['title'] = $data->getTitle();
        $dataArray['description'] = $data->getDescription();
        $dataArray['category'] = $data->getCategory();
        $values = [];
        foreach ($data->getKeywords() as $value) {
            $values[] = $value;
        }
        $dataArray['keywords'] = $values;
        $dataArray['isDeprecated'] = $data->getIsDeprecated();
        $dataArray['deprecatedAt'] = $data->getDeprecatedAt();
        $dataArray['deprecationMessage'] = $data->getDeprecationMessage();
        $dataArray['ownerProjectId'] = $data->getOwnerProjectId();
        $dataArray['latestVersionId'] = $data->getLatestVersionId();
        $dataArray['latestVersion'] = $data->getLatestVersion();
        $dataArray['versionCount'] = $data->getVersionCount();
        $dataArray['installId'] = $data->getInstallId();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding::class => false];
    }
}