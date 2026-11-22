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
class ExperimentVariantJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('weightPercentage', $data) && \is_int($data['weightPercentage'])) {
            $data['weightPercentage'] = (float) $data['weightPercentage'];
        }
        if (\array_key_exists('isControl', $data) && \is_int($data['isControl'])) {
            $data['isControl'] = (bool) $data['isControl'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('isControl', $data)) {
            $object->setIsControl($data['isControl']);
        }
        if (\array_key_exists('weightPercentage', $data)) {
            $object->setWeightPercentage($data['weightPercentage']);
        }
        if (\array_key_exists('placements', $data)) {
            $values = [];
            foreach ($data['placements'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\ExperimentArmPlacement::class, 'json', $context);
            }
            $object->setPlacements($values);
        }
        if (\array_key_exists('flagValues', $data)) {
            $values_1 = [];
            foreach ($data['flagValues'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\ExperimentFlagValue::class, 'json', $context);
            }
            $object->setFlagValues($values_1);
        }
        if (\array_key_exists('stoppedPlacements', $data)) {
            $values_2 = [];
            foreach ($data['stoppedPlacements'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\ExperimentArmStoppedPlacement::class, 'json', $context);
            }
            $object->setStoppedPlacements($values_2);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['isControl'] = $data->getIsControl();
        $dataArray['weightPercentage'] = $data->getWeightPercentage();
        $values = [];
        foreach ($data->getPlacements() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['placements'] = $values;
        $values_1 = [];
        foreach ($data->getFlagValues() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['flagValues'] = $values_1;
        $values_2 = [];
        foreach ($data->getStoppedPlacements() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['stoppedPlacements'] = $values_2;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class => false];
    }
}