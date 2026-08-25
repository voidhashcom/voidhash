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
class ApiV1PushNotificationConfigurationsPostResponse201Normalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('enabled', $data) && \is_int($data['enabled'])) {
            $data['enabled'] = (bool) $data['enabled'];
        }
        if (\array_key_exists('activeProviderId', $data) && $data['activeProviderId'] !== null) {
            $object->setActiveProviderId($data['activeProviderId']);
        }
        elseif (\array_key_exists('activeProviderId', $data) && $data['activeProviderId'] === null) {
            $object->setActiveProviderId(null);
        }
        if (\array_key_exists('configuration', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['configuration'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setConfiguration($values);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('deletedAt', $data) && $data['deletedAt'] !== null) {
            $object->setDeletedAt($data['deletedAt']);
        }
        elseif (\array_key_exists('deletedAt', $data) && $data['deletedAt'] === null) {
            $object->setDeletedAt(null);
        }
        if (\array_key_exists('enabled', $data)) {
            $object->setEnabled($data['enabled']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('providerId', $data)) {
            $object->setProviderId($data['providerId']);
        }
        if (\array_key_exists('pushProviderKey', $data)) {
            $object->setPushProviderKey($data['pushProviderKey']);
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
        $dataArray['activeProviderId'] = $data->getActiveProviderId();
        $values = [];
        foreach ($data->getConfiguration() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['configuration'] = $values;
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['deletedAt'] = $data->getDeletedAt();
        $dataArray['enabled'] = $data->getEnabled();
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['providerId'] = $data->getProviderId();
        $dataArray['pushProviderKey'] = $data->getPushProviderKey();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201::class => false];
    }
}