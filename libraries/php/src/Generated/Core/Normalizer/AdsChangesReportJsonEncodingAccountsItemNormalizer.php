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
class AdsChangesReportJsonEncodingAccountsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncodingAccountsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncodingAccountsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncodingAccountsItem();
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
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('platform', $data)) {
            $object->setPlatform($data['platform']);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('timezone', $data)) {
            $object->setTimezone($data['timezone']);
        }
        if (\array_key_exists('syncedAt', $data) && $data['syncedAt'] !== null) {
            $object->setSyncedAt($data['syncedAt']);
        }
        elseif (\array_key_exists('syncedAt', $data) && $data['syncedAt'] === null) {
            $object->setSyncedAt(null);
        }
        if (\array_key_exists('historySince', $data) && $data['historySince'] !== null) {
            $object->setHistorySince($data['historySince']);
        }
        elseif (\array_key_exists('historySince', $data) && $data['historySince'] === null) {
            $object->setHistorySince(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['platform'] = $data->getPlatform();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['timezone'] = $data->getTimezone();
        $dataArray['syncedAt'] = $data->getSyncedAt();
        $dataArray['historySince'] = $data->getHistorySince();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsChangesReportJsonEncodingAccountsItem::class => false];
    }
}