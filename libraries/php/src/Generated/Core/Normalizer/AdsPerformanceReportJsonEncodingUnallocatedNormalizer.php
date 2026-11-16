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
class AdsPerformanceReportJsonEncodingUnallocatedNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingUnallocated::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingUnallocated::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingUnallocated();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('spend', $data)) {
            $object->setSpend($data['spend']);
        }
        if (\array_key_exists('impressions', $data)) {
            $object->setImpressions($data['impressions']);
        }
        if (\array_key_exists('clicks', $data)) {
            $object->setClicks($data['clicks']);
        }
        if (\array_key_exists('linkClicks', $data) && $data['linkClicks'] !== null) {
            $object->setLinkClicks($data['linkClicks']);
        }
        elseif (\array_key_exists('linkClicks', $data) && $data['linkClicks'] === null) {
            $object->setLinkClicks(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['spend'] = $data->getSpend();
        $dataArray['impressions'] = $data->getImpressions();
        $dataArray['clicks'] = $data->getClicks();
        $dataArray['linkClicks'] = $data->getLinkClicks();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingUnallocated::class => false];
    }
}