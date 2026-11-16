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
class AcquisitionReportResultJsonEncodingCoverageNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverage::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverage::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverage();
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
        if (\array_key_exists('attributedRevenue', $data)) {
            $object->setAttributedRevenue($data['attributedRevenue']);
        }
        if (\array_key_exists('totalRevenue', $data)) {
            $object->setTotalRevenue($data['totalRevenue']);
        }
        if (\array_key_exists('share', $data) && $data['share'] !== null) {
            $object->setShare($data['share']);
        }
        elseif (\array_key_exists('share', $data) && $data['share'] === null) {
            $object->setShare(null);
        }
        if (\array_key_exists('netRevenue', $data)) {
            $object->setNetRevenue($data['netRevenue']);
        }
        if (\array_key_exists('classes', $data)) {
            $values = [];
            foreach ($data['classes'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverageClassesItem::class, 'json', $context);
            }
            $object->setClasses($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['attributedRevenue'] = $data->getAttributedRevenue();
        $dataArray['totalRevenue'] = $data->getTotalRevenue();
        $dataArray['share'] = $data->getShare();
        $dataArray['netRevenue'] = $data->getNetRevenue();
        $values = [];
        foreach ($data->getClasses() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['classes'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverage::class => false];
    }
}