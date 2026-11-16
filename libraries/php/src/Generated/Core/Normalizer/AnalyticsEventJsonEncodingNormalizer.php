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
class AnalyticsEventJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding();
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
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('timestamp', $data)) {
            $object->setTimestamp($data['timestamp']);
        }
        if (\array_key_exists('distinctId', $data)) {
            $object->setDistinctId($data['distinctId']);
        }
        if (\array_key_exists('previousDistinctId', $data) && $data['previousDistinctId'] !== null) {
            $object->setPreviousDistinctId($data['previousDistinctId']);
        }
        elseif (\array_key_exists('previousDistinctId', $data) && $data['previousDistinctId'] === null) {
            $object->setPreviousDistinctId(null);
        }
        if (\array_key_exists('personId', $data) && $data['personId'] !== null) {
            $object->setPersonId($data['personId']);
        }
        elseif (\array_key_exists('personId', $data) && $data['personId'] === null) {
            $object->setPersonId(null);
        }
        if (\array_key_exists('identityMode', $data)) {
            $object->setIdentityMode($data['identityMode']);
        }
        if (\array_key_exists('sessionId', $data) && $data['sessionId'] !== null) {
            $object->setSessionId($data['sessionId']);
        }
        elseif (\array_key_exists('sessionId', $data) && $data['sessionId'] === null) {
            $object->setSessionId(null);
        }
        if (\array_key_exists('properties', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['properties'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setProperties($values);
        }
        if (\array_key_exists('context', $data)) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['context'] as $key_1 => $value_1) {
                $values_1[$key_1] = $value_1;
            }
            $object->setContext($values_1);
        }
        if (\array_key_exists('source', $data)) {
            $object->setSource($data['source']);
        }
        if (\array_key_exists('trustClass', $data)) {
            $object->setTrustClass($data['trustClass']);
        }
        if (\array_key_exists('sentAt', $data) && $data['sentAt'] !== null) {
            $object->setSentAt($data['sentAt']);
        }
        elseif (\array_key_exists('sentAt', $data) && $data['sentAt'] === null) {
            $object->setSentAt(null);
        }
        if (\array_key_exists('receivedAt', $data)) {
            $object->setReceivedAt($data['receivedAt']);
        }
        if (\array_key_exists('processedAt', $data)) {
            $object->setProcessedAt($data['processedAt']);
        }
        if (\array_key_exists('captureId', $data)) {
            $object->setCaptureId($data['captureId']);
        }
        if (\array_key_exists('requestId', $data)) {
            $object->setRequestId($data['requestId']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['name'] = $data->getName();
        $dataArray['timestamp'] = $data->getTimestamp();
        $dataArray['distinctId'] = $data->getDistinctId();
        $dataArray['previousDistinctId'] = $data->getPreviousDistinctId();
        $dataArray['personId'] = $data->getPersonId();
        $dataArray['identityMode'] = $data->getIdentityMode();
        $dataArray['sessionId'] = $data->getSessionId();
        $values = [];
        foreach ($data->getProperties() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['properties'] = $values;
        $values_1 = [];
        foreach ($data->getContext() as $key_1 => $value_1) {
            $values_1[$key_1] = $value_1;
        }
        $dataArray['context'] = $values_1;
        $dataArray['source'] = $data->getSource();
        $dataArray['trustClass'] = $data->getTrustClass();
        $dataArray['sentAt'] = $data->getSentAt();
        $dataArray['receivedAt'] = $data->getReceivedAt();
        $dataArray['processedAt'] = $data->getProcessedAt();
        $dataArray['captureId'] = $data->getCaptureId();
        $dataArray['requestId'] = $data->getRequestId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding::class => false];
    }
}