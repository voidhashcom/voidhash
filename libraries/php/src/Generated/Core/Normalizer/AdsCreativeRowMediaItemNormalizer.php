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
class AdsCreativeRowMediaItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsCreativeRowMediaItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsCreativeRowMediaItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsCreativeRowMediaItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('imageUrl', $data) && $data['imageUrl'] !== null) {
            $object->setImageUrl($data['imageUrl']);
        }
        elseif (\array_key_exists('imageUrl', $data) && $data['imageUrl'] === null) {
            $object->setImageUrl(null);
        }
        if (\array_key_exists('imageHash', $data) && $data['imageHash'] !== null) {
            $object->setImageHash($data['imageHash']);
        }
        elseif (\array_key_exists('imageHash', $data) && $data['imageHash'] === null) {
            $object->setImageHash(null);
        }
        if (\array_key_exists('videoId', $data) && $data['videoId'] !== null) {
            $object->setVideoId($data['videoId']);
        }
        elseif (\array_key_exists('videoId', $data) && $data['videoId'] === null) {
            $object->setVideoId(null);
        }
        if (\array_key_exists('thumbnailUrl', $data) && $data['thumbnailUrl'] !== null) {
            $object->setThumbnailUrl($data['thumbnailUrl']);
        }
        elseif (\array_key_exists('thumbnailUrl', $data) && $data['thumbnailUrl'] === null) {
            $object->setThumbnailUrl(null);
        }
        if (\array_key_exists('headline', $data) && $data['headline'] !== null) {
            $object->setHeadline($data['headline']);
        }
        elseif (\array_key_exists('headline', $data) && $data['headline'] === null) {
            $object->setHeadline(null);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('link', $data) && $data['link'] !== null) {
            $object->setLink($data['link']);
        }
        elseif (\array_key_exists('link', $data) && $data['link'] === null) {
            $object->setLink(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['type'] = $data->getType();
        $dataArray['imageUrl'] = $data->getImageUrl();
        $dataArray['imageHash'] = $data->getImageHash();
        $dataArray['videoId'] = $data->getVideoId();
        $dataArray['thumbnailUrl'] = $data->getThumbnailUrl();
        $dataArray['headline'] = $data->getHeadline();
        $dataArray['description'] = $data->getDescription();
        $dataArray['link'] = $data->getLink();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsCreativeRowMediaItem::class => false];
    }
}