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
class PaywallBuildWithdrawalPlacementNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallBuildWithdrawalPlacement::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallBuildWithdrawalPlacement::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallBuildWithdrawalPlacement();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasShowing', $data) && \is_int($data['hasShowing'])) {
            $data['hasShowing'] = (bool) $data['hasShowing'];
        }
        if (\array_key_exists('hasRules', $data) && \is_int($data['hasRules'])) {
            $data['hasRules'] = (bool) $data['hasRules'];
        }
        if (\array_key_exists('hasPins', $data) && \is_int($data['hasPins'])) {
            $data['hasPins'] = (bool) $data['hasPins'];
        }
        if (\array_key_exists('isPaused', $data) && \is_int($data['isPaused'])) {
            $data['isPaused'] = (bool) $data['isPaused'];
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('paywallLocationId', $data)) {
            $object->setPaywallLocationId($data['paywallLocationId']);
        }
        if (\array_key_exists('paywallLocationName', $data)) {
            $object->setPaywallLocationName($data['paywallLocationName']);
        }
        if (\array_key_exists('hasShowing', $data)) {
            $object->setHasShowing($data['hasShowing']);
        }
        if (\array_key_exists('hasRules', $data)) {
            $object->setHasRules($data['hasRules']);
        }
        if (\array_key_exists('hasPins', $data)) {
            $object->setHasPins($data['hasPins']);
        }
        if (\array_key_exists('experimentId', $data) && $data['experimentId'] !== null) {
            $object->setExperimentId($data['experimentId']);
        }
        elseif (\array_key_exists('experimentId', $data) && $data['experimentId'] === null) {
            $object->setExperimentId(null);
        }
        if (\array_key_exists('experimentName', $data) && $data['experimentName'] !== null) {
            $object->setExperimentName($data['experimentName']);
        }
        elseif (\array_key_exists('experimentName', $data) && $data['experimentName'] === null) {
            $object->setExperimentName(null);
        }
        if (\array_key_exists('variantId', $data) && $data['variantId'] !== null) {
            $object->setVariantId($data['variantId']);
        }
        elseif (\array_key_exists('variantId', $data) && $data['variantId'] === null) {
            $object->setVariantId(null);
        }
        if (\array_key_exists('variantName', $data) && $data['variantName'] !== null) {
            $object->setVariantName($data['variantName']);
        }
        elseif (\array_key_exists('variantName', $data) && $data['variantName'] === null) {
            $object->setVariantName(null);
        }
        if (\array_key_exists('isPaused', $data)) {
            $object->setIsPaused($data['isPaused']);
        }
        if (\array_key_exists('servedBuildNumber', $data) && $data['servedBuildNumber'] !== null) {
            $object->setServedBuildNumber($data['servedBuildNumber']);
        }
        elseif (\array_key_exists('servedBuildNumber', $data) && $data['servedBuildNumber'] === null) {
            $object->setServedBuildNumber(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['kind'] = $data->getKind();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['paywallLocationId'] = $data->getPaywallLocationId();
        $dataArray['paywallLocationName'] = $data->getPaywallLocationName();
        $dataArray['hasShowing'] = $data->getHasShowing();
        $dataArray['hasRules'] = $data->getHasRules();
        $dataArray['hasPins'] = $data->getHasPins();
        $dataArray['experimentId'] = $data->getExperimentId();
        $dataArray['experimentName'] = $data->getExperimentName();
        $dataArray['variantId'] = $data->getVariantId();
        $dataArray['variantName'] = $data->getVariantName();
        $dataArray['isPaused'] = $data->getIsPaused();
        $dataArray['servedBuildNumber'] = $data->getServedBuildNumber();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallBuildWithdrawalPlacement::class => false];
    }
}