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
class SdkPurchasePaywallContextNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkPurchasePaywallContext::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkPurchasePaywallContext::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkPurchasePaywallContext();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('showingId', $data)) {
            $object->setShowingId($data['showingId']);
        }
        if (\array_key_exists('placement', $data) && $data['placement'] !== null) {
            $object->setPlacement($data['placement']);
        }
        elseif (\array_key_exists('placement', $data) && $data['placement'] === null) {
            $object->setPlacement(null);
        }
        if (\array_key_exists('paywallId', $data) && $data['paywallId'] !== null) {
            $object->setPaywallId($data['paywallId']);
        }
        elseif (\array_key_exists('paywallId', $data) && $data['paywallId'] === null) {
            $object->setPaywallId(null);
        }
        if (\array_key_exists('paywallReleaseId', $data) && $data['paywallReleaseId'] !== null) {
            $object->setPaywallReleaseId($data['paywallReleaseId']);
        }
        elseif (\array_key_exists('paywallReleaseId', $data) && $data['paywallReleaseId'] === null) {
            $object->setPaywallReleaseId(null);
        }
        if (\array_key_exists('source', $data) && $data['source'] !== null) {
            $object->setSource($data['source']);
        }
        elseif (\array_key_exists('source', $data) && $data['source'] === null) {
            $object->setSource(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['showingId'] = $data->getShowingId();
        if ($data->isInitialized('placement')) {
            $dataArray['placement'] = $data->getPlacement();
        }
        if ($data->isInitialized('paywallId')) {
            $dataArray['paywallId'] = $data->getPaywallId();
        }
        if ($data->isInitialized('paywallReleaseId')) {
            $dataArray['paywallReleaseId'] = $data->getPaywallReleaseId();
        }
        if ($data->isInitialized('source')) {
            $dataArray['source'] = $data->getSource();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkPurchasePaywallContext::class => false];
    }
}