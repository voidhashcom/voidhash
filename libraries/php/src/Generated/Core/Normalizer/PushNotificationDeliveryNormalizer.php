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
class PushNotificationDeliveryNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PushNotificationDelivery::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PushNotificationDelivery::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PushNotificationDelivery();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('attemptCount', $data)) {
            $object->setAttemptCount($data['attemptCount']);
        }
        if (\array_key_exists('completedAt', $data) && $data['completedAt'] !== null) {
            $object->setCompletedAt($data['completedAt']);
        }
        elseif (\array_key_exists('completedAt', $data) && $data['completedAt'] === null) {
            $object->setCompletedAt(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('lastError', $data) && $data['lastError'] !== null) {
            $object->setLastError($data['lastError']);
        }
        elseif (\array_key_exists('lastError', $data) && $data['lastError'] === null) {
            $object->setLastError(null);
        }
        if (\array_key_exists('maxAttempts', $data)) {
            $object->setMaxAttempts($data['maxAttempts']);
        }
        if (\array_key_exists('nextAttemptAt', $data) && $data['nextAttemptAt'] !== null) {
            $object->setNextAttemptAt($data['nextAttemptAt']);
        }
        elseif (\array_key_exists('nextAttemptAt', $data) && $data['nextAttemptAt'] === null) {
            $object->setNextAttemptAt(null);
        }
        if (\array_key_exists('personId', $data)) {
            $object->setPersonId($data['personId']);
        }
        if (\array_key_exists('provider', $data)) {
            $object->setProvider($data['provider']);
        }
        if (\array_key_exists('providerMessageId', $data) && $data['providerMessageId'] !== null) {
            $object->setProviderMessageId($data['providerMessageId']);
        }
        elseif (\array_key_exists('providerMessageId', $data) && $data['providerMessageId'] === null) {
            $object->setProviderMessageId(null);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['attemptCount'] = $data->getAttemptCount();
        $dataArray['completedAt'] = $data->getCompletedAt();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['id'] = $data->getId();
        $dataArray['lastError'] = $data->getLastError();
        $dataArray['maxAttempts'] = $data->getMaxAttempts();
        $dataArray['nextAttemptAt'] = $data->getNextAttemptAt();
        $dataArray['personId'] = $data->getPersonId();
        $dataArray['provider'] = $data->getProvider();
        $dataArray['providerMessageId'] = $data->getProviderMessageId();
        $dataArray['status'] = $data->getStatus();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PushNotificationDelivery::class => false];
    }
}