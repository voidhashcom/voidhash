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
class UpdateAutomationBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('name', $data) && $data['name'] !== null) {
            $object->setName($data['name']);
        }
        elseif (\array_key_exists('name', $data) && $data['name'] === null) {
            $object->setName(null);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('environment', $data) && $data['environment'] !== null) {
            $object->setEnvironment($data['environment']);
        }
        elseif (\array_key_exists('environment', $data) && $data['environment'] === null) {
            $object->setEnvironment(null);
        }
        if (\array_key_exists('definition', $data)) {
            $object->setDefinition($this->denormalizer->denormalize($data['definition'], \Voidhash\Generated\Core\Model\AutomationDefinition::class, 'json', $context));
        }
        if (\array_key_exists('expectedRevision', $data) && $data['expectedRevision'] !== null) {
            $object->setExpectedRevision($data['expectedRevision']);
        }
        elseif (\array_key_exists('expectedRevision', $data) && $data['expectedRevision'] === null) {
            $object->setExpectedRevision(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('name')) {
            $dataArray['name'] = $data->getName();
        }
        if ($data->isInitialized('description')) {
            $dataArray['description'] = $data->getDescription();
        }
        if ($data->isInitialized('environment')) {
            $dataArray['environment'] = $data->getEnvironment();
        }
        if ($data->isInitialized('definition') && null !== $data->getDefinition()) {
            $dataArray['definition'] = $this->normalizer->normalize($data->getDefinition(), 'json', $context);
        }
        if ($data->isInitialized('expectedRevision')) {
            $dataArray['expectedRevision'] = $data->getExpectedRevision();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding::class => false];
    }
}