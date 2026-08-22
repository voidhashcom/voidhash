<?php

namespace Voidhash\Generated\EventCapture\Normalizer;

use Jane\Component\JsonSchemaRuntime\Reference;
use Voidhash\Generated\EventCapture\Runtime\Normalizer\CheckArray;
use Voidhash\Generated\EventCapture\Runtime\Normalizer\ValidatorTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
class IV1CapturePostBodyNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('uuid', $data)) {
            $object->setUuid($data['uuid']);
        }
        if (\array_key_exists('event', $data)) {
            $object->setEvent($data['event']);
        }
        if (\array_key_exists('context', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['context'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setContext($values);
        }
        if (\array_key_exists('properties', $data)) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['properties'] as $key_1 => $value_1) {
                $values_1[$key_1] = $value_1;
            }
            $object->setProperties($values_1);
        }
        if (\array_key_exists('distinct_id', $data)) {
            $object->setDistinctId($data['distinct_id']);
        }
        if (\array_key_exists('session_id', $data) && $data['session_id'] !== null) {
            $object->setSessionId($data['session_id']);
        }
        elseif (\array_key_exists('session_id', $data) && $data['session_id'] === null) {
            $object->setSessionId(null);
        }
        if (\array_key_exists('timestamp', $data) && $data['timestamp'] !== null) {
            $object->setTimestamp($data['timestamp']);
        }
        elseif (\array_key_exists('timestamp', $data) && $data['timestamp'] === null) {
            $object->setTimestamp(null);
        }
        if (\array_key_exists('sent_at', $data)) {
            $object->setSentAt($data['sent_at']);
        }
        if (\array_key_exists('token', $data) && $data['token'] !== null) {
            $object->setToken($data['token']);
        }
        elseif (\array_key_exists('token', $data) && $data['token'] === null) {
            $object->setToken(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['uuid'] = $data->getUuid();
        $dataArray['event'] = $data->getEvent();
        $values = [];
        foreach ($data->getContext() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['context'] = $values;
        $values_1 = [];
        foreach ($data->getProperties() as $key_1 => $value_1) {
            $values_1[$key_1] = $value_1;
        }
        $dataArray['properties'] = $values_1;
        $dataArray['distinct_id'] = $data->getDistinctId();
        if ($data->isInitialized('sessionId')) {
            $dataArray['session_id'] = $data->getSessionId();
        }
        if ($data->isInitialized('timestamp')) {
            $dataArray['timestamp'] = $data->getTimestamp();
        }
        $dataArray['sent_at'] = $data->getSentAt();
        if ($data->isInitialized('token')) {
            $dataArray['token'] = $data->getToken();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\EventCapture\Model\IV1CapturePostBody::class => false];
    }
}