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
class SdkResolvedPaywallShowingJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('paywall', $data) && $data['paywall'] !== null) {
            $object->setPaywall($this->denormalizer->denormalize($data['paywall'], \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywall::class, 'json', $context));
        }
        elseif (\array_key_exists('paywall', $data) && $data['paywall'] === null) {
            $object->setPaywall(null);
        }
        if (\array_key_exists('paywallId', $data) && $data['paywallId'] !== null) {
            $object->setPaywallId($data['paywallId']);
        }
        elseif (\array_key_exists('paywallId', $data) && $data['paywallId'] === null) {
            $object->setPaywallId(null);
        }
        if (\array_key_exists('paywallRelease', $data) && $data['paywallRelease'] !== null) {
            $object->setPaywallRelease($this->denormalizer->denormalize($data['paywallRelease'], \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class, 'json', $context));
        }
        elseif (\array_key_exists('paywallRelease', $data) && $data['paywallRelease'] === null) {
            $object->setPaywallRelease(null);
        }
        if (\array_key_exists('paywallReleaseId', $data) && $data['paywallReleaseId'] !== null) {
            $object->setPaywallReleaseId($data['paywallReleaseId']);
        }
        elseif (\array_key_exists('paywallReleaseId', $data) && $data['paywallReleaseId'] === null) {
            $object->setPaywallReleaseId(null);
        }
        if (\array_key_exists('startedAt', $data)) {
            $object->setStartedAt($data['startedAt']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['paywall'] = $this->normalizer->normalize($data->getPaywall(), 'json', $context);
        $dataArray['paywallId'] = $data->getPaywallId();
        $dataArray['paywallRelease'] = $this->normalizer->normalize($data->getPaywallRelease(), 'json', $context);
        $dataArray['paywallReleaseId'] = $data->getPaywallReleaseId();
        $dataArray['startedAt'] = $data->getStartedAt();
        $dataArray['type'] = $data->getType();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding::class => false];
    }
}