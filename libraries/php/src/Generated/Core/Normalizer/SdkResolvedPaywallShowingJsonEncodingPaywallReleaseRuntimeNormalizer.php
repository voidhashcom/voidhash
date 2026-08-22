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
class SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntimeNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('contentHash', $data)) {
            $object->setContentHash($data['contentHash']);
        }
        if (\array_key_exists('productSlugs', $data)) {
            $values = [];
            foreach ($data['productSlugs'] as $value) {
                $values[] = $value;
            }
            $object->setProductSlugs($values);
        }
        if (\array_key_exists('variables', $data)) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['variables'] as $key => $value_1) {
                $values_1[$key] = $value_1;
            }
            $object->setVariables($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['contentHash'] = $data->getContentHash();
        $values = [];
        foreach ($data->getProductSlugs() as $value) {
            $values[] = $value;
        }
        $dataArray['productSlugs'] = $values;
        $values_1 = [];
        foreach ($data->getVariables() as $key => $value_1) {
            $values_1[$key] = $value_1;
        }
        $dataArray['variables'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime::class => false];
    }
}