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
class ExperimentVariantResultJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('conversionRate', $data) && \is_int($data['conversionRate'])) {
            $data['conversionRate'] = (float) $data['conversionRate'];
        }
        if (\array_key_exists('variantId', $data)) {
            $object->setVariantId($data['variantId']);
        }
        if (\array_key_exists('exposures', $data)) {
            $object->setExposures($data['exposures']);
        }
        if (\array_key_exists('conversions', $data)) {
            $object->setConversions($data['conversions']);
        }
        if (\array_key_exists('conversionRate', $data)) {
            $object->setConversionRate($data['conversionRate']);
        }
        if (\array_key_exists('revenue', $data)) {
            $object->setRevenue($data['revenue']);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['variantId'] = $data->getVariantId();
        $dataArray['exposures'] = $data->getExposures();
        $dataArray['conversions'] = $data->getConversions();
        $dataArray['conversionRate'] = $data->getConversionRate();
        $dataArray['revenue'] = $data->getRevenue();
        $dataArray['currency'] = $data->getCurrency();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding::class => false];
    }
}