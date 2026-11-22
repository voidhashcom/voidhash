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
class ExperimentArmBuildChangeNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExperimentArmBuildChange::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExperimentArmBuildChange::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExperimentArmBuildChange();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('fromPaywallId', $data) && $data['fromPaywallId'] !== null) {
            $object->setFromPaywallId($data['fromPaywallId']);
        }
        elseif (\array_key_exists('fromPaywallId', $data) && $data['fromPaywallId'] === null) {
            $object->setFromPaywallId(null);
        }
        if (\array_key_exists('fromBuildNumber', $data) && $data['fromBuildNumber'] !== null) {
            $object->setFromBuildNumber($data['fromBuildNumber']);
        }
        elseif (\array_key_exists('fromBuildNumber', $data) && $data['fromBuildNumber'] === null) {
            $object->setFromBuildNumber(null);
        }
        if (\array_key_exists('toPaywallId', $data) && $data['toPaywallId'] !== null) {
            $object->setToPaywallId($data['toPaywallId']);
        }
        elseif (\array_key_exists('toPaywallId', $data) && $data['toPaywallId'] === null) {
            $object->setToPaywallId(null);
        }
        if (\array_key_exists('toBuildNumber', $data) && $data['toBuildNumber'] !== null) {
            $object->setToBuildNumber($data['toBuildNumber']);
        }
        elseif (\array_key_exists('toBuildNumber', $data) && $data['toBuildNumber'] === null) {
            $object->setToBuildNumber(null);
        }
        if (\array_key_exists('changedAt', $data)) {
            $object->setChangedAt($data['changedAt']);
        }
        if (\array_key_exists('changedByUserId', $data) && $data['changedByUserId'] !== null) {
            $object->setChangedByUserId($data['changedByUserId']);
        }
        elseif (\array_key_exists('changedByUserId', $data) && $data['changedByUserId'] === null) {
            $object->setChangedByUserId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['fromPaywallId'] = $data->getFromPaywallId();
        $dataArray['fromBuildNumber'] = $data->getFromBuildNumber();
        $dataArray['toPaywallId'] = $data->getToPaywallId();
        $dataArray['toBuildNumber'] = $data->getToBuildNumber();
        $dataArray['changedAt'] = $data->getChangedAt();
        $dataArray['changedByUserId'] = $data->getChangedByUserId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExperimentArmBuildChange::class => false];
    }
}