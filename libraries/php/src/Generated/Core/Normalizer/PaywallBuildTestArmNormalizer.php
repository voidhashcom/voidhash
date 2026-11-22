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
class PaywallBuildTestArmNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallBuildTestArm::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallBuildTestArm::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallBuildTestArm();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isPaused', $data) && \is_int($data['isPaused'])) {
            $data['isPaused'] = (bool) $data['isPaused'];
        }
        if (\array_key_exists('experimentId', $data)) {
            $object->setExperimentId($data['experimentId']);
        }
        if (\array_key_exists('experimentName', $data)) {
            $object->setExperimentName($data['experimentName']);
        }
        if (\array_key_exists('isPaused', $data)) {
            $object->setIsPaused($data['isPaused']);
        }
        if (\array_key_exists('variantId', $data)) {
            $object->setVariantId($data['variantId']);
        }
        if (\array_key_exists('variantName', $data)) {
            $object->setVariantName($data['variantName']);
        }
        if (\array_key_exists('paywallLocationId', $data)) {
            $object->setPaywallLocationId($data['paywallLocationId']);
        }
        if (\array_key_exists('paywallLocationName', $data)) {
            $object->setPaywallLocationName($data['paywallLocationName']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('keptBuildNumber', $data) && $data['keptBuildNumber'] !== null) {
            $object->setKeptBuildNumber($data['keptBuildNumber']);
        }
        elseif (\array_key_exists('keptBuildNumber', $data) && $data['keptBuildNumber'] === null) {
            $object->setKeptBuildNumber(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['experimentId'] = $data->getExperimentId();
        $dataArray['experimentName'] = $data->getExperimentName();
        $dataArray['isPaused'] = $data->getIsPaused();
        $dataArray['variantId'] = $data->getVariantId();
        $dataArray['variantName'] = $data->getVariantName();
        $dataArray['paywallLocationId'] = $data->getPaywallLocationId();
        $dataArray['paywallLocationName'] = $data->getPaywallLocationName();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['keptBuildNumber'] = $data->getKeptBuildNumber();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallBuildTestArm::class => false];
    }
}