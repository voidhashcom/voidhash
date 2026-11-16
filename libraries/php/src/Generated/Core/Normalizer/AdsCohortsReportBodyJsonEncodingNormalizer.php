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
class AdsCohortsReportBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('from', $data)) {
            $object->setFrom($data['from']);
        }
        if (\array_key_exists('to', $data)) {
            $object->setTo($data['to']);
        }
        if (\array_key_exists('currency', $data) && $data['currency'] !== null) {
            $object->setCurrency($data['currency']);
        }
        elseif (\array_key_exists('currency', $data) && $data['currency'] === null) {
            $object->setCurrency(null);
        }
        if (\array_key_exists('timezone', $data) && $data['timezone'] !== null) {
            $object->setTimezone($data['timezone']);
        }
        elseif (\array_key_exists('timezone', $data) && $data['timezone'] === null) {
            $object->setTimezone(null);
        }
        if (\array_key_exists('environment', $data) && $data['environment'] !== null) {
            $object->setEnvironment($data['environment']);
        }
        elseif (\array_key_exists('environment', $data) && $data['environment'] === null) {
            $object->setEnvironment(null);
        }
        if (\array_key_exists('groupBy', $data)) {
            $object->setGroupBy($data['groupBy']);
        }
        if (\array_key_exists('unit', $data)) {
            $object->setUnit($data['unit']);
        }
        if (\array_key_exists('metric', $data)) {
            $object->setMetric($data['metric']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['from'] = $data->getFrom();
        $dataArray['to'] = $data->getTo();
        if ($data->isInitialized('currency')) {
            $dataArray['currency'] = $data->getCurrency();
        }
        if ($data->isInitialized('timezone')) {
            $dataArray['timezone'] = $data->getTimezone();
        }
        if ($data->isInitialized('environment')) {
            $dataArray['environment'] = $data->getEnvironment();
        }
        $dataArray['groupBy'] = $data->getGroupBy();
        $dataArray['unit'] = $data->getUnit();
        $dataArray['metric'] = $data->getMetric();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding::class => false];
    }
}