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
class CreateAutomationRunBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('personId', $data)) {
            $object->setPersonId($data['personId']);
        }
        if (\array_key_exists('event', $data)) {
            $object->setEvent($this->denormalizer->denormalize($data['event'], \Voidhash\Generated\Core\Model\AutomationEventInput::class, 'json', $context));
        }
        if (\array_key_exists('inputs', $data) && $data['inputs'] !== null) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['inputs'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setInputs($values);
        }
        elseif (\array_key_exists('inputs', $data) && $data['inputs'] === null) {
            $object->setInputs(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['personId'] = $data->getPersonId();
        if ($data->isInitialized('event') && null !== $data->getEvent()) {
            $dataArray['event'] = $this->normalizer->normalize($data->getEvent(), 'json', $context);
        }
        if ($data->isInitialized('inputs')) {
            $values = [];
            foreach ($data->getInputs() as $key => $value) {
                $values[$key] = $value;
            }
            $dataArray['inputs'] = $values;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding::class => false];
    }
}