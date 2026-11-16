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
class AdsChangesReportBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('since', $data)) {
            $object->setSince($data['since']);
        }
        if (\array_key_exists('until', $data) && $data['until'] !== null) {
            $object->setUntil($data['until']);
        }
        elseif (\array_key_exists('until', $data) && $data['until'] === null) {
            $object->setUntil(null);
        }
        if (\array_key_exists('level', $data)) {
            $object->setLevel($data['level']);
        }
        if (\array_key_exists('campaignIds', $data) && $data['campaignIds'] !== null) {
            $values = [];
            foreach ($data['campaignIds'] as $value) {
                $values[] = $value;
            }
            $object->setCampaignIds($values);
        }
        elseif (\array_key_exists('campaignIds', $data) && $data['campaignIds'] === null) {
            $object->setCampaignIds(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['since'] = $data->getSince();
        if ($data->isInitialized('until')) {
            $dataArray['until'] = $data->getUntil();
        }
        if ($data->isInitialized('level') && null !== $data->getLevel()) {
            $dataArray['level'] = $data->getLevel();
        }
        if ($data->isInitialized('campaignIds')) {
            $values = [];
            foreach ($data->getCampaignIds() as $value) {
                $values[] = $value;
            }
            $dataArray['campaignIds'] = $values;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding::class => false];
    }
}