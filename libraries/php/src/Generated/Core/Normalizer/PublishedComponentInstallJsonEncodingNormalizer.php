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
class PublishedComponentInstallJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding();
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
        if (\array_key_exists('registryComponentId', $data)) {
            $object->setRegistryComponentId($data['registryComponentId']);
        }
        if (\array_key_exists('slug', $data)) {
            $object->setSlug($data['slug']);
        }
        if (\array_key_exists('versionRange', $data)) {
            $object->setVersionRange($data['versionRange']);
        }
        if (\array_key_exists('versionId', $data)) {
            $object->setVersionId($data['versionId']);
        }
        if (\array_key_exists('version', $data)) {
            $object->setVersion($data['version']);
        }
        if (\array_key_exists('versionStatus', $data)) {
            $object->setVersionStatus($data['versionStatus']);
        }
        if (\array_key_exists('consentedCapabilities', $data)) {
            $values = [];
            foreach ($data['consentedCapabilities'] as $value) {
                $values[] = $value;
            }
            $object->setConsentedCapabilities($values);
        }
        if (\array_key_exists('availableUpdate', $data) && $data['availableUpdate'] !== null) {
            $object->setAvailableUpdate($data['availableUpdate']);
        }
        elseif (\array_key_exists('availableUpdate', $data) && $data['availableUpdate'] === null) {
            $object->setAvailableUpdate(null);
        }
        if (\array_key_exists('installedBy', $data)) {
            $object->setInstalledBy($data['installedBy']);
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
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['registryComponentId'] = $data->getRegistryComponentId();
        $dataArray['slug'] = $data->getSlug();
        $dataArray['versionRange'] = $data->getVersionRange();
        $dataArray['versionId'] = $data->getVersionId();
        $dataArray['version'] = $data->getVersion();
        $dataArray['versionStatus'] = $data->getVersionStatus();
        $values = [];
        foreach ($data->getConsentedCapabilities() as $value) {
            $values[] = $value;
        }
        $dataArray['consentedCapabilities'] = $values;
        $dataArray['availableUpdate'] = $data->getAvailableUpdate();
        $dataArray['installedBy'] = $data->getInstalledBy();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding::class => false];
    }
}