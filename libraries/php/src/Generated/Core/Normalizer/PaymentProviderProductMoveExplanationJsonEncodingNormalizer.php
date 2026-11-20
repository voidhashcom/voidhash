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
class PaymentProviderProductMoveExplanationJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaymentProviderProductMoveExplanationJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaymentProviderProductMoveExplanationJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaymentProviderProductMoveExplanationJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isSoldOnTarget', $data) && \is_int($data['isSoldOnTarget'])) {
            $data['isSoldOnTarget'] = (bool) $data['isSoldOnTarget'];
        }
        if (\array_key_exists('refusal', $data)) {
            $object->setRefusal($this->denormalizer->denormalize($data['refusal'], \Voidhash\Generated\Core\Model\PaymentProviderProductMoveRefusal::class, 'json', $context));
        }
        if (\array_key_exists('subscriptionCount', $data)) {
            $object->setSubscriptionCount($data['subscriptionCount']);
        }
        if (\array_key_exists('activeSubscriptionCount', $data)) {
            $object->setActiveSubscriptionCount($data['activeSubscriptionCount']);
        }
        if (\array_key_exists('purchaseCount', $data)) {
            $object->setPurchaseCount($data['purchaseCount']);
        }
        if (\array_key_exists('perksGained', $data)) {
            $values = [];
            foreach ($data['perksGained'] as $value) {
                $values[] = $value;
            }
            $object->setPerksGained($values);
        }
        if (\array_key_exists('perksLost', $data)) {
            $values_1 = [];
            foreach ($data['perksLost'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setPerksLost($values_1);
        }
        if (\array_key_exists('isSoldOnTarget', $data)) {
            $object->setIsSoldOnTarget($data['isSoldOnTarget']);
        }
        if (\array_key_exists('promotedMappingId', $data) && $data['promotedMappingId'] !== null) {
            $object->setPromotedMappingId($data['promotedMappingId']);
        }
        elseif (\array_key_exists('promotedMappingId', $data) && $data['promotedMappingId'] === null) {
            $object->setPromotedMappingId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['refusal'] = $this->normalizer->normalize($data->getRefusal(), 'json', $context);
        $dataArray['subscriptionCount'] = $data->getSubscriptionCount();
        $dataArray['activeSubscriptionCount'] = $data->getActiveSubscriptionCount();
        $dataArray['purchaseCount'] = $data->getPurchaseCount();
        $values = [];
        foreach ($data->getPerksGained() as $value) {
            $values[] = $value;
        }
        $dataArray['perksGained'] = $values;
        $values_1 = [];
        foreach ($data->getPerksLost() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['perksLost'] = $values_1;
        $dataArray['isSoldOnTarget'] = $data->getIsSoldOnTarget();
        $dataArray['promotedMappingId'] = $data->getPromotedMappingId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaymentProviderProductMoveExplanationJsonEncoding::class => false];
    }
}