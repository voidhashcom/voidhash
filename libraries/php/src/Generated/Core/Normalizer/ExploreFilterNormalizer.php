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
class ExploreFilterNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExploreFilter::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExploreFilter::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExploreFilter();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('dimension', $data)) {
            $value = $data['dimension'];
            if (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'store')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreStoreDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'product')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreProductDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'country')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreCountryDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'billing_period')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreBillingPeriodDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'paywall')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExplorePaywallDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'placement')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExplorePlacementDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'offer')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreOfferDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'acquisition_source')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreAcquisitionSourceDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'plan')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExplorePlanDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'trait') and \array_key_exists('key', $data['dimension'])) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreTraitDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'property') and \array_key_exists('key', $data['dimension'])) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExplorePropertyDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'cohort')) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreCohortDimension::class, 'json', $context);
            } elseif (is_array($data['dimension']) and (\array_key_exists('kind', $data['dimension']) and $data['dimension']['kind'] == 'group') and \array_key_exists('groupType', $data['dimension'])) {
                $value = $this->denormalizer->denormalize($data['dimension'], \Voidhash\Generated\Core\Model\ExploreGroupDimension::class, 'json', $context);
            }
            $object->setDimension($value);
        }
        if (\array_key_exists('op', $data)) {
            $object->setOp($data['op']);
        }
        if (\array_key_exists('values', $data)) {
            $values = [];
            foreach ($data['values'] as $value_1) {
                $values[] = $value_1;
            }
            $object->setValues($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $value = $data->getDimension();
        if (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        } elseif (is_object($data->getDimension())) {
            $value = $this->normalizer->normalize($data->getDimension(), 'json', $context);
        }
        $dataArray['dimension'] = $value;
        $dataArray['op'] = $data->getOp();
        $values = [];
        foreach ($data->getValues() as $value_1) {
            $values[] = $value_1;
        }
        $dataArray['values'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExploreFilter::class => false];
    }
}