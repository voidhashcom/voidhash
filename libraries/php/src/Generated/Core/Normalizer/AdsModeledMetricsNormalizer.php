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
class AdsModeledMetricsNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsModeledMetrics::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsModeledMetrics::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsModeledMetrics();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('roasHigh', $data) && \is_int($data['roasHigh'])) {
            $data['roasHigh'] = (float) $data['roasHigh'];
        }
        if (\array_key_exists('visitCoverage', $data) && \is_int($data['visitCoverage'])) {
            $data['visitCoverage'] = (float) $data['visitCoverage'];
        }
        if (\array_key_exists('netRevenueHigh', $data)) {
            $object->setNetRevenueHigh($data['netRevenueHigh']);
        }
        if (\array_key_exists('roasHigh', $data) && $data['roasHigh'] !== null) {
            $object->setRoasHigh($data['roasHigh']);
        }
        elseif (\array_key_exists('roasHigh', $data) && $data['roasHigh'] === null) {
            $object->setRoasHigh(null);
        }
        if (\array_key_exists('visitCoverage', $data)) {
            $object->setVisitCoverage($data['visitCoverage']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['netRevenueHigh'] = $data->getNetRevenueHigh();
        $dataArray['roasHigh'] = $data->getRoasHigh();
        $dataArray['visitCoverage'] = $data->getVisitCoverage();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsModeledMetrics::class => false];
    }
}