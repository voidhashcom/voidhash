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
class PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem();
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
        if (\array_key_exists('name', $data) && $data['name'] !== null) {
            $object->setName($data['name']);
        }
        elseif (\array_key_exists('name', $data) && $data['name'] === null) {
            $object->setName(null);
        }
        if (\array_key_exists('identities', $data) && $data['identities'] !== null) {
            $values = [];
            foreach ($data['identities'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\FeatureFlagIdentityRef::class, 'json', $context);
            }
            $object->setIdentities($values);
        }
        elseif (\array_key_exists('identities', $data) && $data['identities'] === null) {
            $object->setIdentities(null);
        }
        if (\array_key_exists('conditions', $data) && $data['conditions'] !== null) {
            $values_1 = [];
            foreach ($data['conditions'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\FeatureFlagConditionInput::class, 'json', $context);
            }
            $object->setConditions($values_1);
        }
        elseif (\array_key_exists('conditions', $data) && $data['conditions'] === null) {
            $object->setConditions(null);
        }
        if (\array_key_exists('serve', $data)) {
            $object->setServe($this->denormalizer->denormalize($data['serve'], \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        if ($data->isInitialized('name')) {
            $dataArray['name'] = $data->getName();
        }
        if ($data->isInitialized('identities')) {
            $values = [];
            foreach ($data->getIdentities() as $value) {
                $values[] = $this->normalizer->normalize($value, 'json', $context);
            }
            $dataArray['identities'] = $values;
        }
        if ($data->isInitialized('conditions')) {
            $values_1 = [];
            foreach ($data->getConditions() as $value_1) {
                $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
            }
            $dataArray['conditions'] = $values_1;
        }
        $dataArray['serve'] = $this->normalizer->normalize($data->getServe(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem::class => false];
    }
}