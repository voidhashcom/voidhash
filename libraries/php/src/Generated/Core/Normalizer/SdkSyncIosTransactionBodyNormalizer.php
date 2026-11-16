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
class SdkSyncIosTransactionBodyNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkSyncIosTransactionBody::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkSyncIosTransactionBody::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkSyncIosTransactionBody();
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
        if (\array_key_exists('transactionId', $data)) {
            $object->setTransactionId($data['transactionId']);
        }
        if (\array_key_exists('intent', $data) && $data['intent'] !== null) {
            $object->setIntent($data['intent']);
        }
        elseif (\array_key_exists('intent', $data) && $data['intent'] === null) {
            $object->setIntent(null);
        }
        if (\array_key_exists('paywallContext', $data)) {
            $object->setPaywallContext($this->denormalizer->denormalize($data['paywallContext'], \Voidhash\Generated\Core\Model\SdkPurchasePaywallContext::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['platform'] = $data->getPlatform();
        $dataArray['transactionId'] = $data->getTransactionId();
        if ($data->isInitialized('intent')) {
            $dataArray['intent'] = $data->getIntent();
        }
        if ($data->isInitialized('paywallContext') && null !== $data->getPaywallContext()) {
            $dataArray['paywallContext'] = $this->normalizer->normalize($data->getPaywallContext(), 'json', $context);
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkSyncIosTransactionBody::class => false];
    }
}