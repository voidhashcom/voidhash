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
class PublishedComponentInstallReviewJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isConsentRequired', $data) && \is_int($data['isConsentRequired'])) {
            $data['isConsentRequired'] = (bool) $data['isConsentRequired'];
        }
        if (\array_key_exists('registryComponentId', $data)) {
            $object->setRegistryComponentId($data['registryComponentId']);
        }
        if (\array_key_exists('versionRange', $data)) {
            $object->setVersionRange($data['versionRange']);
        }
        if (\array_key_exists('currentVersionId', $data) && $data['currentVersionId'] !== null) {
            $object->setCurrentVersionId($data['currentVersionId']);
        }
        elseif (\array_key_exists('currentVersionId', $data) && $data['currentVersionId'] === null) {
            $object->setCurrentVersionId(null);
        }
        if (\array_key_exists('currentVersion', $data) && $data['currentVersion'] !== null) {
            $object->setCurrentVersion($data['currentVersion']);
        }
        elseif (\array_key_exists('currentVersion', $data) && $data['currentVersion'] === null) {
            $object->setCurrentVersion(null);
        }
        if (\array_key_exists('targetVersionId', $data)) {
            $object->setTargetVersionId($data['targetVersionId']);
        }
        if (\array_key_exists('targetVersion', $data)) {
            $object->setTargetVersion($data['targetVersion']);
        }
        if (\array_key_exists('targetCapabilities', $data)) {
            $values = [];
            foreach ($data['targetCapabilities'] as $value) {
                $values[] = $value;
            }
            $object->setTargetCapabilities($values);
        }
        if (\array_key_exists('addedCapabilities', $data)) {
            $values_1 = [];
            foreach ($data['addedCapabilities'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setAddedCapabilities($values_1);
        }
        if (\array_key_exists('changes', $data)) {
            $values_2 = [];
            foreach ($data['changes'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\PublishedComponentChange::class, 'json', $context);
            }
            $object->setChanges($values_2);
        }
        if (\array_key_exists('isConsentRequired', $data)) {
            $object->setIsConsentRequired($data['isConsentRequired']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['registryComponentId'] = $data->getRegistryComponentId();
        $dataArray['versionRange'] = $data->getVersionRange();
        $dataArray['currentVersionId'] = $data->getCurrentVersionId();
        $dataArray['currentVersion'] = $data->getCurrentVersion();
        $dataArray['targetVersionId'] = $data->getTargetVersionId();
        $dataArray['targetVersion'] = $data->getTargetVersion();
        $values = [];
        foreach ($data->getTargetCapabilities() as $value) {
            $values[] = $value;
        }
        $dataArray['targetCapabilities'] = $values;
        $values_1 = [];
        foreach ($data->getAddedCapabilities() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['addedCapabilities'] = $values_1;
        $values_2 = [];
        foreach ($data->getChanges() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['changes'] = $values_2;
        $dataArray['isConsentRequired'] = $data->getIsConsentRequired();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding::class => false];
    }
}