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
class WebhookDeliveryWithAttemptsJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding();
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
        if (\array_key_exists('webhookId', $data)) {
            $object->setWebhookId($data['webhookId']);
        }
        if (\array_key_exists('eventType', $data)) {
            $object->setEventType($data['eventType']);
        }
        if (\array_key_exists('payload', $data)) {
            $object->setPayload($data['payload']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('attemptCount', $data)) {
            $object->setAttemptCount($data['attemptCount']);
        }
        if (\array_key_exists('maxAttempts', $data)) {
            $object->setMaxAttempts($data['maxAttempts']);
        }
        if (\array_key_exists('eventOccurredAt', $data)) {
            $object->setEventOccurredAt($data['eventOccurredAt']);
        }
        if (\array_key_exists('nextAttemptAt', $data) && $data['nextAttemptAt'] !== null) {
            $object->setNextAttemptAt($data['nextAttemptAt']);
        }
        elseif (\array_key_exists('nextAttemptAt', $data) && $data['nextAttemptAt'] === null) {
            $object->setNextAttemptAt(null);
        }
        if (\array_key_exists('completedAt', $data) && $data['completedAt'] !== null) {
            $object->setCompletedAt($data['completedAt']);
        }
        elseif (\array_key_exists('completedAt', $data) && $data['completedAt'] === null) {
            $object->setCompletedAt(null);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('attempts', $data)) {
            $values = [];
            foreach ($data['attempts'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class, 'json', $context);
            }
            $object->setAttempts($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['webhookId'] = $data->getWebhookId();
        $dataArray['eventType'] = $data->getEventType();
        $dataArray['payload'] = $data->getPayload();
        $dataArray['status'] = $data->getStatus();
        $dataArray['attemptCount'] = $data->getAttemptCount();
        $dataArray['maxAttempts'] = $data->getMaxAttempts();
        $dataArray['eventOccurredAt'] = $data->getEventOccurredAt();
        $dataArray['nextAttemptAt'] = $data->getNextAttemptAt();
        $dataArray['completedAt'] = $data->getCompletedAt();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $values = [];
        foreach ($data->getAttempts() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['attempts'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class => false];
    }
}