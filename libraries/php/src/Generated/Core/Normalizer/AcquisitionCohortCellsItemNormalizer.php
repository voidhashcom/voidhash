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
class AcquisitionCohortCellsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AcquisitionCohortCellsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AcquisitionCohortCellsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AcquisitionCohortCellsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('day', $data)) {
            $object->setDay($data['day']);
        }
        if (\array_key_exists('people', $data)) {
            $object->setPeople($data['people']);
        }
        if (\array_key_exists('payingPeople', $data)) {
            $object->setPayingPeople($data['payingPeople']);
        }
        if (\array_key_exists('grossRevenue', $data)) {
            $object->setGrossRevenue($data['grossRevenue']);
        }
        if (\array_key_exists('refunds', $data)) {
            $object->setRefunds($data['refunds']);
        }
        if (\array_key_exists('netRevenue', $data)) {
            $object->setNetRevenue($data['netRevenue']);
        }
        if (\array_key_exists('maturity', $data)) {
            $object->setMaturity($data['maturity']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['day'] = $data->getDay();
        $dataArray['people'] = $data->getPeople();
        $dataArray['payingPeople'] = $data->getPayingPeople();
        $dataArray['grossRevenue'] = $data->getGrossRevenue();
        $dataArray['refunds'] = $data->getRefunds();
        $dataArray['netRevenue'] = $data->getNetRevenue();
        $dataArray['maturity'] = $data->getMaturity();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AcquisitionCohortCellsItem::class => false];
    }
}