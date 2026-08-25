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
class DevelopmentStateNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\DevelopmentState::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\DevelopmentState::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\DevelopmentState();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('developmentPurchasesEnabled', $data) && \is_int($data['developmentPurchasesEnabled'])) {
            $data['developmentPurchasesEnabled'] = (bool) $data['developmentPurchasesEnabled'];
        }
        if (\array_key_exists('developmentPurchasesEnabled', $data)) {
            $object->setDevelopmentPurchasesEnabled($data['developmentPurchasesEnabled']);
        }
        if (\array_key_exists('grants', $data)) {
            $values = [];
            foreach ($data['grants'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\DevelopmentStateGrantsItem::class, 'json', $context);
            }
            $object->setGrants($values);
        }
        if (\array_key_exists('purchases', $data)) {
            $values_1 = [];
            foreach ($data['purchases'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\DevelopmentStatePurchasesItem::class, 'json', $context);
            }
            $object->setPurchases($values_1);
        }
        if (\array_key_exists('subscriptions', $data)) {
            $values_2 = [];
            foreach ($data['subscriptions'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\DevelopmentStateSubscriptionsItem::class, 'json', $context);
            }
            $object->setSubscriptions($values_2);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['developmentPurchasesEnabled'] = $data->getDevelopmentPurchasesEnabled();
        $values = [];
        foreach ($data->getGrants() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['grants'] = $values;
        $values_1 = [];
        foreach ($data->getPurchases() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['purchases'] = $values_1;
        $values_2 = [];
        foreach ($data->getSubscriptions() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['subscriptions'] = $values_2;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\DevelopmentState::class => false];
    }
}