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
class RegisterDeviceBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('platform', $data)) {
            $object->setPlatform($data['platform']);
        }
        if (\array_key_exists('provider', $data)) {
            $object->setProvider($data['provider']);
        }
        if (\array_key_exists('platformToken', $data)) {
            $object->setPlatformToken($data['platformToken']);
        }
        if (\array_key_exists('bundleId', $data) && $data['bundleId'] !== null) {
            $object->setBundleId($data['bundleId']);
        }
        elseif (\array_key_exists('bundleId', $data) && $data['bundleId'] === null) {
            $object->setBundleId(null);
        }
        if (\array_key_exists('environment', $data) && $data['environment'] !== null) {
            $object->setEnvironment($data['environment']);
        }
        elseif (\array_key_exists('environment', $data) && $data['environment'] === null) {
            $object->setEnvironment(null);
        }
        if (\array_key_exists('previousPushDeviceTokenId', $data) && $data['previousPushDeviceTokenId'] !== null) {
            $object->setPreviousPushDeviceTokenId($data['previousPushDeviceTokenId']);
        }
        elseif (\array_key_exists('previousPushDeviceTokenId', $data) && $data['previousPushDeviceTokenId'] === null) {
            $object->setPreviousPushDeviceTokenId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['platform'] = $data->getPlatform();
        $dataArray['provider'] = $data->getProvider();
        $dataArray['platformToken'] = $data->getPlatformToken();
        if ($data->isInitialized('bundleId')) {
            $dataArray['bundleId'] = $data->getBundleId();
        }
        if ($data->isInitialized('environment')) {
            $dataArray['environment'] = $data->getEnvironment();
        }
        if ($data->isInitialized('previousPushDeviceTokenId')) {
            $dataArray['previousPushDeviceTokenId'] = $data->getPreviousPushDeviceTokenId();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding::class => false];
    }
}