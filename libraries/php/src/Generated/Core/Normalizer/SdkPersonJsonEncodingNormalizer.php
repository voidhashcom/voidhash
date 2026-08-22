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
class SdkPersonJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkPersonJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkPersonJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkPersonJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('distinctId', $data)) {
            $object->setDistinctId($data['distinctId']);
        }
        if (\array_key_exists('email', $data) && $data['email'] !== null) {
            $object->setEmail($data['email']);
        }
        elseif (\array_key_exists('email', $data) && $data['email'] === null) {
            $object->setEmail(null);
        }
        if (\array_key_exists('entitlements', $data)) {
            $object->setEntitlements($this->denormalizer->denormalize($data['entitlements'], \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingEntitlements::class, 'json', $context));
        }
        if (\array_key_exists('name', $data) && $data['name'] !== null) {
            $object->setName($data['name']);
        }
        elseif (\array_key_exists('name', $data) && $data['name'] === null) {
            $object->setName(null);
        }
        if (\array_key_exists('personId', $data)) {
            $object->setPersonId($data['personId']);
        }
        if (\array_key_exists('purchases', $data)) {
            $object->setPurchases($this->denormalizer->denormalize($data['purchases'], \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingPurchases::class, 'json', $context));
        }
        if (\array_key_exists('snapshotContext', $data)) {
            $object->setSnapshotContext($this->denormalizer->denormalize($data['snapshotContext'], \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSnapshotContext::class, 'json', $context));
        }
        if (\array_key_exists('subscriptions', $data)) {
            $object->setSubscriptions($this->denormalizer->denormalize($data['subscriptions'], \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSubscriptions::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['distinctId'] = $data->getDistinctId();
        $dataArray['email'] = $data->getEmail();
        $dataArray['entitlements'] = $this->normalizer->normalize($data->getEntitlements(), 'json', $context);
        $dataArray['name'] = $data->getName();
        $dataArray['personId'] = $data->getPersonId();
        $dataArray['purchases'] = $this->normalizer->normalize($data->getPurchases(), 'json', $context);
        $dataArray['snapshotContext'] = $this->normalizer->normalize($data->getSnapshotContext(), 'json', $context);
        $dataArray['subscriptions'] = $this->normalizer->normalize($data->getSubscriptions(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkPersonJsonEncoding::class => false];
    }
}