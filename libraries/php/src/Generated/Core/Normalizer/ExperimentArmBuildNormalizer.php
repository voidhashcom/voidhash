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
class ExperimentArmBuildNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExperimentArmBuild::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExperimentArmBuild::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExperimentArmBuild();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('keptBuildId', $data) && $data['keptBuildId'] !== null) {
            $object->setKeptBuildId($data['keptBuildId']);
        }
        elseif (\array_key_exists('keptBuildId', $data) && $data['keptBuildId'] === null) {
            $object->setKeptBuildId(null);
        }
        if (\array_key_exists('keptBuildNumber', $data) && $data['keptBuildNumber'] !== null) {
            $object->setKeptBuildNumber($data['keptBuildNumber']);
        }
        elseif (\array_key_exists('keptBuildNumber', $data) && $data['keptBuildNumber'] === null) {
            $object->setKeptBuildNumber(null);
        }
        if (\array_key_exists('deployedBuildNumber', $data) && $data['deployedBuildNumber'] !== null) {
            $object->setDeployedBuildNumber($data['deployedBuildNumber']);
        }
        elseif (\array_key_exists('deployedBuildNumber', $data) && $data['deployedBuildNumber'] === null) {
            $object->setDeployedBuildNumber(null);
        }
        if (\array_key_exists('concludedBuildNumber', $data) && $data['concludedBuildNumber'] !== null) {
            $object->setConcludedBuildNumber($data['concludedBuildNumber']);
        }
        elseif (\array_key_exists('concludedBuildNumber', $data) && $data['concludedBuildNumber'] === null) {
            $object->setConcludedBuildNumber(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['keptBuildId'] = $data->getKeptBuildId();
        $dataArray['keptBuildNumber'] = $data->getKeptBuildNumber();
        $dataArray['deployedBuildNumber'] = $data->getDeployedBuildNumber();
        $dataArray['concludedBuildNumber'] = $data->getConcludedBuildNumber();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExperimentArmBuild::class => false];
    }
}