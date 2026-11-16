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
class AdsCreativeRowNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsCreativeRow::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsCreativeRow::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsCreativeRow();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('ctr', $data) && \is_int($data['ctr'])) {
            $data['ctr'] = (float) $data['ctr'];
        }
        if (\array_key_exists('hookRate', $data) && \is_int($data['hookRate'])) {
            $data['hookRate'] = (float) $data['hookRate'];
        }
        if (\array_key_exists('platformRoas', $data) && \is_int($data['platformRoas'])) {
            $data['platformRoas'] = (float) $data['platformRoas'];
        }
        if (\array_key_exists('roas', $data) && \is_int($data['roas'])) {
            $data['roas'] = (float) $data['roas'];
        }
        if (\array_key_exists('frequency', $data) && \is_int($data['frequency'])) {
            $data['frequency'] = (float) $data['frequency'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('format', $data)) {
            $object->setFormat($data['format']);
        }
        if (\array_key_exists('videoDurationSeconds', $data) && $data['videoDurationSeconds'] !== null) {
            $object->setVideoDurationSeconds($data['videoDurationSeconds']);
        }
        elseif (\array_key_exists('videoDurationSeconds', $data) && $data['videoDurationSeconds'] === null) {
            $object->setVideoDurationSeconds(null);
        }
        if (\array_key_exists('cardCount', $data) && $data['cardCount'] !== null) {
            $object->setCardCount($data['cardCount']);
        }
        elseif (\array_key_exists('cardCount', $data) && $data['cardCount'] === null) {
            $object->setCardCount(null);
        }
        if (\array_key_exists('thumbnailUrl', $data) && $data['thumbnailUrl'] !== null) {
            $object->setThumbnailUrl($data['thumbnailUrl']);
        }
        elseif (\array_key_exists('thumbnailUrl', $data) && $data['thumbnailUrl'] === null) {
            $object->setThumbnailUrl(null);
        }
        if (\array_key_exists('copy', $data)) {
            $object->setCopy($this->denormalizer->denormalize($data['copy'], \Voidhash\Generated\Core\Model\AdsCreativeRowCopy::class, 'json', $context));
        }
        if (\array_key_exists('media', $data)) {
            $values = [];
            foreach ($data['media'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsCreativeRowMediaItem::class, 'json', $context);
            }
            $object->setMedia($values);
        }
        if (\array_key_exists('callToAction', $data) && $data['callToAction'] !== null) {
            $object->setCallToAction($data['callToAction']);
        }
        elseif (\array_key_exists('callToAction', $data) && $data['callToAction'] === null) {
            $object->setCallToAction(null);
        }
        if (\array_key_exists('landingUrl', $data) && $data['landingUrl'] !== null) {
            $object->setLandingUrl($data['landingUrl']);
        }
        elseif (\array_key_exists('landingUrl', $data) && $data['landingUrl'] === null) {
            $object->setLandingUrl(null);
        }
        if (\array_key_exists('adCount', $data)) {
            $object->setAdCount($data['adCount']);
        }
        if (\array_key_exists('deliveryStatus', $data)) {
            $object->setDeliveryStatus($data['deliveryStatus']);
        }
        if (\array_key_exists('adsInDeliveryStatus', $data)) {
            $object->setAdsInDeliveryStatus($data['adsInDeliveryStatus']);
        }
        if (\array_key_exists('spend', $data)) {
            $object->setSpend($data['spend']);
        }
        if (\array_key_exists('ctr', $data) && $data['ctr'] !== null) {
            $object->setCtr($data['ctr']);
        }
        elseif (\array_key_exists('ctr', $data) && $data['ctr'] === null) {
            $object->setCtr(null);
        }
        if (\array_key_exists('hookRate', $data) && $data['hookRate'] !== null) {
            $object->setHookRate($data['hookRate']);
        }
        elseif (\array_key_exists('hookRate', $data) && $data['hookRate'] === null) {
            $object->setHookRate(null);
        }
        if (\array_key_exists('platformRoas', $data) && $data['platformRoas'] !== null) {
            $object->setPlatformRoas($data['platformRoas']);
        }
        elseif (\array_key_exists('platformRoas', $data) && $data['platformRoas'] === null) {
            $object->setPlatformRoas(null);
        }
        if (\array_key_exists('roas', $data) && $data['roas'] !== null) {
            $object->setRoas($data['roas']);
        }
        elseif (\array_key_exists('roas', $data) && $data['roas'] === null) {
            $object->setRoas(null);
        }
        if (\array_key_exists('costPerPayer', $data) && $data['costPerPayer'] !== null) {
            $object->setCostPerPayer($data['costPerPayer']);
        }
        elseif (\array_key_exists('costPerPayer', $data) && $data['costPerPayer'] === null) {
            $object->setCostPerPayer(null);
        }
        if (\array_key_exists('frequency', $data) && $data['frequency'] !== null) {
            $object->setFrequency($data['frequency']);
        }
        elseif (\array_key_exists('frequency', $data) && $data['frequency'] === null) {
            $object->setFrequency(null);
        }
        if (\array_key_exists('fatigue', $data) && $data['fatigue'] !== null) {
            $object->setFatigue($this->denormalizer->denormalize($data['fatigue'], \Voidhash\Generated\Core\Model\AdsCreativeRowFatigue::class, 'json', $context));
        }
        elseif (\array_key_exists('fatigue', $data) && $data['fatigue'] === null) {
            $object->setFatigue(null);
        }
        if (\array_key_exists('platformUrl', $data)) {
            $object->setPlatformUrl($data['platformUrl']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['format'] = $data->getFormat();
        $dataArray['videoDurationSeconds'] = $data->getVideoDurationSeconds();
        $dataArray['cardCount'] = $data->getCardCount();
        $dataArray['thumbnailUrl'] = $data->getThumbnailUrl();
        $dataArray['copy'] = $this->normalizer->normalize($data->getCopy(), 'json', $context);
        $values = [];
        foreach ($data->getMedia() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['media'] = $values;
        $dataArray['callToAction'] = $data->getCallToAction();
        $dataArray['landingUrl'] = $data->getLandingUrl();
        $dataArray['adCount'] = $data->getAdCount();
        $dataArray['deliveryStatus'] = $data->getDeliveryStatus();
        $dataArray['adsInDeliveryStatus'] = $data->getAdsInDeliveryStatus();
        $dataArray['spend'] = $data->getSpend();
        $dataArray['ctr'] = $data->getCtr();
        $dataArray['hookRate'] = $data->getHookRate();
        $dataArray['platformRoas'] = $data->getPlatformRoas();
        $dataArray['roas'] = $data->getRoas();
        $dataArray['costPerPayer'] = $data->getCostPerPayer();
        $dataArray['frequency'] = $data->getFrequency();
        $dataArray['fatigue'] = $this->normalizer->normalize($data->getFatigue(), 'json', $context);
        $dataArray['platformUrl'] = $data->getPlatformUrl();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsCreativeRow::class => false];
    }
}