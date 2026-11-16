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
class AutomationTestResultJsonEncodingStepsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncodingStepsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncodingStepsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncodingStepsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('stepId', $data)) {
            $object->setStepId($data['stepId']);
        }
        if (\array_key_exists('stepType', $data)) {
            $object->setStepType($data['stepType']);
        }
        if (\array_key_exists('port', $data) && $data['port'] !== null) {
            $object->setPort($data['port']);
        }
        elseif (\array_key_exists('port', $data) && $data['port'] === null) {
            $object->setPort(null);
        }
        if (\array_key_exists('action', $data) && $data['action'] !== null) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['action'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setAction($values);
        }
        elseif (\array_key_exists('action', $data) && $data['action'] === null) {
            $object->setAction(null);
        }
        if (\array_key_exists('waitSeconds', $data) && $data['waitSeconds'] !== null) {
            $object->setWaitSeconds($data['waitSeconds']);
        }
        elseif (\array_key_exists('waitSeconds', $data) && $data['waitSeconds'] === null) {
            $object->setWaitSeconds(null);
        }
        if (\array_key_exists('waitsFor', $data) && $data['waitsFor'] !== null) {
            $object->setWaitsFor($data['waitsFor']);
        }
        elseif (\array_key_exists('waitsFor', $data) && $data['waitsFor'] === null) {
            $object->setWaitsFor(null);
        }
        if (\array_key_exists('problem', $data) && $data['problem'] !== null) {
            $object->setProblem($data['problem']);
        }
        elseif (\array_key_exists('problem', $data) && $data['problem'] === null) {
            $object->setProblem(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['stepId'] = $data->getStepId();
        $dataArray['stepType'] = $data->getStepType();
        $dataArray['port'] = $data->getPort();
        $values = [];
        foreach ($data->getAction() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['action'] = $values;
        $dataArray['waitSeconds'] = $data->getWaitSeconds();
        $dataArray['waitsFor'] = $data->getWaitsFor();
        $dataArray['problem'] = $data->getProblem();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationTestResultJsonEncodingStepsItem::class => false];
    }
}