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
class PaywallLocationShowingJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding();
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
        if (\array_key_exists('paywallLocationId', $data)) {
            $object->setPaywallLocationId($data['paywallLocationId']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('paywallId', $data) && $data['paywallId'] !== null) {
            $object->setPaywallId($data['paywallId']);
        }
        elseif (\array_key_exists('paywallId', $data) && $data['paywallId'] === null) {
            $object->setPaywallId(null);
        }
        if (\array_key_exists('buildNumber', $data) && $data['buildNumber'] !== null) {
            $object->setBuildNumber($data['buildNumber']);
        }
        elseif (\array_key_exists('buildNumber', $data) && $data['buildNumber'] === null) {
            $object->setBuildNumber(null);
        }
        if (\array_key_exists('featureFlagId', $data) && $data['featureFlagId'] !== null) {
            $object->setFeatureFlagId($data['featureFlagId']);
        }
        elseif (\array_key_exists('featureFlagId', $data) && $data['featureFlagId'] === null) {
            $object->setFeatureFlagId(null);
        }
        if (\array_key_exists('startedAt', $data)) {
            $object->setStartedAt($data['startedAt']);
        }
        if (\array_key_exists('endedAt', $data) && $data['endedAt'] !== null) {
            $object->setEndedAt($data['endedAt']);
        }
        elseif (\array_key_exists('endedAt', $data) && $data['endedAt'] === null) {
            $object->setEndedAt(null);
        }
        if (\array_key_exists('createdByUserId', $data) && $data['createdByUserId'] !== null) {
            $object->setCreatedByUserId($data['createdByUserId']);
        }
        elseif (\array_key_exists('createdByUserId', $data) && $data['createdByUserId'] === null) {
            $object->setCreatedByUserId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['paywallLocationId'] = $data->getPaywallLocationId();
        $dataArray['type'] = $data->getType();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['paywallId'] = $data->getPaywallId();
        $dataArray['buildNumber'] = $data->getBuildNumber();
        $dataArray['featureFlagId'] = $data->getFeatureFlagId();
        $dataArray['startedAt'] = $data->getStartedAt();
        $dataArray['endedAt'] = $data->getEndedAt();
        $dataArray['createdByUserId'] = $data->getCreatedByUserId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding::class => false];
    }
}