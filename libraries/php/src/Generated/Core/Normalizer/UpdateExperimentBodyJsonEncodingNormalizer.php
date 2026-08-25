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
class UpdateExperimentBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('hypothesis', $data) && $data['hypothesis'] !== null) {
            $object->setHypothesis($data['hypothesis']);
        }
        elseif (\array_key_exists('hypothesis', $data) && $data['hypothesis'] === null) {
            $object->setHypothesis(null);
        }
        if (\array_key_exists('name', $data) && $data['name'] !== null) {
            $object->setName($data['name']);
        }
        elseif (\array_key_exists('name', $data) && $data['name'] === null) {
            $object->setName(null);
        }
        if (\array_key_exists('primaryMetricEventName', $data) && $data['primaryMetricEventName'] !== null) {
            $object->setPrimaryMetricEventName($data['primaryMetricEventName']);
        }
        elseif (\array_key_exists('primaryMetricEventName', $data) && $data['primaryMetricEventName'] === null) {
            $object->setPrimaryMetricEventName(null);
        }
        if (\array_key_exists('secondaryMetricEventNames', $data) && $data['secondaryMetricEventNames'] !== null) {
            $values = [];
            foreach ($data['secondaryMetricEventNames'] as $value) {
                $values[] = $value;
            }
            $object->setSecondaryMetricEventNames($values);
        }
        elseif (\array_key_exists('secondaryMetricEventNames', $data) && $data['secondaryMetricEventNames'] === null) {
            $object->setSecondaryMetricEventNames(null);
        }
        if (\array_key_exists('variants', $data) && $data['variants'] !== null) {
            $values_1 = [];
            foreach ($data['variants'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncodingVariantsItem::class, 'json', $context);
            }
            $object->setVariants($values_1);
        }
        elseif (\array_key_exists('variants', $data) && $data['variants'] === null) {
            $object->setVariants(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('description')) {
            $dataArray['description'] = $data->getDescription();
        }
        if ($data->isInitialized('hypothesis')) {
            $dataArray['hypothesis'] = $data->getHypothesis();
        }
        if ($data->isInitialized('name')) {
            $dataArray['name'] = $data->getName();
        }
        if ($data->isInitialized('primaryMetricEventName')) {
            $dataArray['primaryMetricEventName'] = $data->getPrimaryMetricEventName();
        }
        if ($data->isInitialized('secondaryMetricEventNames')) {
            $values = [];
            foreach ($data->getSecondaryMetricEventNames() as $value) {
                $values[] = $value;
            }
            $dataArray['secondaryMetricEventNames'] = $values;
        }
        if ($data->isInitialized('variants')) {
            $values_1 = [];
            foreach ($data->getVariants() as $value_1) {
                $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
            }
            $dataArray['variants'] = $values_1;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding::class => false];
    }
}