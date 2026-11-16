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
class ImagePreviewJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('contentType', $data)) {
            $object->setContentType($data['contentType']);
        }
        if (\array_key_exists('imageBase64', $data)) {
            $object->setImageBase64($data['imageBase64']);
        }
        if (\array_key_exists('width', $data)) {
            $object->setWidth($data['width']);
        }
        if (\array_key_exists('height', $data)) {
            $object->setHeight($data['height']);
        }
        if (\array_key_exists('sourceWidth', $data)) {
            $object->setSourceWidth($data['sourceWidth']);
        }
        if (\array_key_exists('sourceHeight', $data)) {
            $object->setSourceHeight($data['sourceHeight']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['contentType'] = $data->getContentType();
        $dataArray['imageBase64'] = $data->getImageBase64();
        $dataArray['width'] = $data->getWidth();
        $dataArray['height'] = $data->getHeight();
        $dataArray['sourceWidth'] = $data->getSourceWidth();
        $dataArray['sourceHeight'] = $data->getSourceHeight();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding::class => false];
    }
}