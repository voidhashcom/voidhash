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
class AcquisitionReportResultJsonEncodingCoverageClassesItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverageClassesItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverageClassesItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverageClassesItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('share', $data) && \is_int($data['share'])) {
            $data['share'] = (float) $data['share'];
        }
        if (\array_key_exists('class', $data)) {
            $object->setClass($data['class']);
        }
        if (\array_key_exists('network', $data) && $data['network'] !== null) {
            $object->setNetwork($data['network']);
        }
        elseif (\array_key_exists('network', $data) && $data['network'] === null) {
            $object->setNetwork(null);
        }
        if (\array_key_exists('reason', $data) && $data['reason'] !== null) {
            $object->setReason($data['reason']);
        }
        elseif (\array_key_exists('reason', $data) && $data['reason'] === null) {
            $object->setReason(null);
        }
        if (\array_key_exists('netRevenue', $data)) {
            $object->setNetRevenue($data['netRevenue']);
        }
        if (\array_key_exists('share', $data) && $data['share'] !== null) {
            $object->setShare($data['share']);
        }
        elseif (\array_key_exists('share', $data) && $data['share'] === null) {
            $object->setShare(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['class'] = $data->getClass();
        $dataArray['network'] = $data->getNetwork();
        $dataArray['reason'] = $data->getReason();
        $dataArray['netRevenue'] = $data->getNetRevenue();
        $dataArray['share'] = $data->getShare();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverageClassesItem::class => false];
    }
}