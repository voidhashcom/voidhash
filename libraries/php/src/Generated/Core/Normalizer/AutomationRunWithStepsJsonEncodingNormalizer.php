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
class AutomationRunWithStepsJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationRunWithStepsJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationRunWithStepsJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationRunWithStepsJsonEncoding();
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
        if (\array_key_exists('automationId', $data)) {
            $object->setAutomationId($data['automationId']);
        }
        if (\array_key_exists('versionId', $data)) {
            $object->setVersionId($data['versionId']);
        }
        if (\array_key_exists('personId', $data)) {
            $object->setPersonId($data['personId']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('currentStepId', $data) && $data['currentStepId'] !== null) {
            $object->setCurrentStepId($data['currentStepId']);
        }
        elseif (\array_key_exists('currentStepId', $data) && $data['currentStepId'] === null) {
            $object->setCurrentStepId(null);
        }
        if (\array_key_exists('waitingForEvent', $data) && $data['waitingForEvent'] !== null) {
            $object->setWaitingForEvent($data['waitingForEvent']);
        }
        elseif (\array_key_exists('waitingForEvent', $data) && $data['waitingForEvent'] === null) {
            $object->setWaitingForEvent(null);
        }
        if (\array_key_exists('nextAt', $data) && $data['nextAt'] !== null) {
            $object->setNextAt($data['nextAt']);
        }
        elseif (\array_key_exists('nextAt', $data) && $data['nextAt'] === null) {
            $object->setNextAt(null);
        }
        if (\array_key_exists('lastError', $data) && $data['lastError'] !== null) {
            $object->setLastError($data['lastError']);
        }
        elseif (\array_key_exists('lastError', $data) && $data['lastError'] === null) {
            $object->setLastError(null);
        }
        if (\array_key_exists('event', $data)) {
            $object->setEvent($this->denormalizer->denormalize($data['event'], \Voidhash\Generated\Core\Model\AutomationContextEvent::class, 'json', $context));
        }
        if (\array_key_exists('variables', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['variables'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setVariables($values);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('finishedAt', $data) && $data['finishedAt'] !== null) {
            $object->setFinishedAt($data['finishedAt']);
        }
        elseif (\array_key_exists('finishedAt', $data) && $data['finishedAt'] === null) {
            $object->setFinishedAt(null);
        }
        if (\array_key_exists('steps', $data)) {
            $values_1 = [];
            foreach ($data['steps'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AutomationRunStepJsonEncoding::class, 'json', $context);
            }
            $object->setSteps($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['automationId'] = $data->getAutomationId();
        $dataArray['versionId'] = $data->getVersionId();
        $dataArray['personId'] = $data->getPersonId();
        $dataArray['status'] = $data->getStatus();
        $dataArray['currentStepId'] = $data->getCurrentStepId();
        $dataArray['waitingForEvent'] = $data->getWaitingForEvent();
        $dataArray['nextAt'] = $data->getNextAt();
        $dataArray['lastError'] = $data->getLastError();
        $dataArray['event'] = $this->normalizer->normalize($data->getEvent(), 'json', $context);
        $values = [];
        foreach ($data->getVariables() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['variables'] = $values;
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['finishedAt'] = $data->getFinishedAt();
        $values_1 = [];
        foreach ($data->getSteps() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['steps'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationRunWithStepsJsonEncoding::class => false];
    }
}