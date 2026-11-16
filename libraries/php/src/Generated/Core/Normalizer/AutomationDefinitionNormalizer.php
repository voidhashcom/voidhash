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
class AutomationDefinitionNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationDefinition::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationDefinition::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationDefinition();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('version', $data)) {
            $object->setVersion($data['version']);
        }
        if (\array_key_exists('trigger', $data)) {
            $object->setTrigger($this->denormalizer->denormalize($data['trigger'], \Voidhash\Generated\Core\Model\AutomationTrigger::class, 'json', $context));
        }
        if (\array_key_exists('nodes', $data)) {
            $values = [];
            foreach ($data['nodes'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AutomationNode::class, 'json', $context);
            }
            $object->setNodes($values);
        }
        if (\array_key_exists('settings', $data)) {
            $object->setSettings($this->denormalizer->denormalize($data['settings'], \Voidhash\Generated\Core\Model\AutomationSettings::class, 'json', $context));
        }
        if (\array_key_exists('variables', $data) && $data['variables'] !== null) {
            $values_1 = [];
            foreach ($data['variables'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AutomationVariable::class, 'json', $context);
            }
            $object->setVariables($values_1);
        }
        elseif (\array_key_exists('variables', $data) && $data['variables'] === null) {
            $object->setVariables(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['version'] = $data->getVersion();
        $dataArray['trigger'] = $this->normalizer->normalize($data->getTrigger(), 'json', $context);
        $values = [];
        foreach ($data->getNodes() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['nodes'] = $values;
        $dataArray['settings'] = $this->normalizer->normalize($data->getSettings(), 'json', $context);
        if ($data->isInitialized('variables')) {
            $values_1 = [];
            foreach ($data->getVariables() as $value_1) {
                $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
            }
            $dataArray['variables'] = $values_1;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationDefinition::class => false];
    }
}