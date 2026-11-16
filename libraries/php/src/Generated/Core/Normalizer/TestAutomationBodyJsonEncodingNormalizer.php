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
class TestAutomationBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('personId', $data) && $data['personId'] !== null) {
            $object->setPersonId($data['personId']);
        }
        elseif (\array_key_exists('personId', $data) && $data['personId'] === null) {
            $object->setPersonId(null);
        }
        if (\array_key_exists('event', $data)) {
            $object->setEvent($this->denormalizer->denormalize($data['event'], \Voidhash\Generated\Core\Model\AutomationEventInput::class, 'json', $context));
        }
        if (\array_key_exists('receivedEvents', $data) && $data['receivedEvents'] !== null) {
            $values = [];
            foreach ($data['receivedEvents'] as $value) {
                $values[] = $value;
            }
            $object->setReceivedEvents($values);
        }
        elseif (\array_key_exists('receivedEvents', $data) && $data['receivedEvents'] === null) {
            $object->setReceivedEvents(null);
        }
        if (\array_key_exists('inputs', $data) && $data['inputs'] !== null) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['inputs'] as $key => $value_1) {
                $values_1[$key] = $value_1;
            }
            $object->setInputs($values_1);
        }
        elseif (\array_key_exists('inputs', $data) && $data['inputs'] === null) {
            $object->setInputs(null);
        }
        if (\array_key_exists('assumedVariants', $data) && $data['assumedVariants'] !== null) {
            $values_2 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['assumedVariants'] as $key_1 => $value_2) {
                $values_2[$key_1] = $value_2;
            }
            $object->setAssumedVariants($values_2);
        }
        elseif (\array_key_exists('assumedVariants', $data) && $data['assumedVariants'] === null) {
            $object->setAssumedVariants(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('personId')) {
            $dataArray['personId'] = $data->getPersonId();
        }
        if ($data->isInitialized('event') && null !== $data->getEvent()) {
            $dataArray['event'] = $this->normalizer->normalize($data->getEvent(), 'json', $context);
        }
        if ($data->isInitialized('receivedEvents')) {
            $values = [];
            foreach ($data->getReceivedEvents() as $value) {
                $values[] = $value;
            }
            $dataArray['receivedEvents'] = $values;
        }
        if ($data->isInitialized('inputs')) {
            $values_1 = [];
            foreach ($data->getInputs() as $key => $value_1) {
                $values_1[$key] = $value_1;
            }
            $dataArray['inputs'] = $values_1;
        }
        if ($data->isInitialized('assumedVariants')) {
            $values_2 = [];
            foreach ($data->getAssumedVariants() as $key_1 => $value_2) {
                $values_2[$key_1] = $value_2;
            }
            $dataArray['assumedVariants'] = $values_2;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding::class => false];
    }
}