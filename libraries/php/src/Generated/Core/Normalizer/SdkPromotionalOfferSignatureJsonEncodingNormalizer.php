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
class SdkPromotionalOfferSignatureJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('offerIdentifier', $data)) {
            $object->setOfferIdentifier($data['offerIdentifier']);
        }
        if (\array_key_exists('keyIdentifier', $data)) {
            $object->setKeyIdentifier($data['keyIdentifier']);
        }
        if (\array_key_exists('nonce', $data)) {
            $object->setNonce($data['nonce']);
        }
        if (\array_key_exists('signature', $data)) {
            $object->setSignature($data['signature']);
        }
        if (\array_key_exists('timestamp', $data)) {
            $object->setTimestamp($data['timestamp']);
        }
        if (\array_key_exists('appAccountToken', $data)) {
            $object->setAppAccountToken($data['appAccountToken']);
        }
        if (\array_key_exists('signatureJws', $data)) {
            $object->setSignatureJws($data['signatureJws']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['offerIdentifier'] = $data->getOfferIdentifier();
        $dataArray['keyIdentifier'] = $data->getKeyIdentifier();
        $dataArray['nonce'] = $data->getNonce();
        $dataArray['signature'] = $data->getSignature();
        $dataArray['timestamp'] = $data->getTimestamp();
        $dataArray['appAccountToken'] = $data->getAppAccountToken();
        if ($data->isInitialized('signatureJws') && null !== $data->getSignatureJws()) {
            $dataArray['signatureJws'] = $data->getSignatureJws();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureJsonEncoding::class => false];
    }
}