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
class AutomationRunStepJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationRunStepJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationRunStepJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationRunStepJsonEncoding();
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
        if (\array_key_exists('stepId', $data)) {
            $object->setStepId($data['stepId']);
        }
        if (\array_key_exists('stepType', $data)) {
            $object->setStepType($data['stepType']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('port', $data) && $data['port'] !== null) {
            $object->setPort($data['port']);
        }
        elseif (\array_key_exists('port', $data) && $data['port'] === null) {
            $object->setPort(null);
        }
        if (\array_key_exists('output', $data) && $data['output'] !== null) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['output'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setOutput($values);
        }
        elseif (\array_key_exists('output', $data) && $data['output'] === null) {
            $object->setOutput(null);
        }
        if (\array_key_exists('error', $data) && $data['error'] !== null) {
            $object->setError($data['error']);
        }
        elseif (\array_key_exists('error', $data) && $data['error'] === null) {
            $object->setError(null);
        }
        if (\array_key_exists('startedAt', $data)) {
            $object->setStartedAt($data['startedAt']);
        }
        if (\array_key_exists('finishedAt', $data) && $data['finishedAt'] !== null) {
            $object->setFinishedAt($data['finishedAt']);
        }
        elseif (\array_key_exists('finishedAt', $data) && $data['finishedAt'] === null) {
            $object->setFinishedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['stepId'] = $data->getStepId();
        $dataArray['stepType'] = $data->getStepType();
        $dataArray['status'] = $data->getStatus();
        $dataArray['port'] = $data->getPort();
        $values = [];
        foreach ($data->getOutput() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['output'] = $values;
        $dataArray['error'] = $data->getError();
        $dataArray['startedAt'] = $data->getStartedAt();
        $dataArray['finishedAt'] = $data->getFinishedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationRunStepJsonEncoding::class => false];
    }
}