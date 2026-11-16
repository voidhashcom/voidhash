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
class AssetJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AssetJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AssetJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AssetJsonEncoding();
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
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('url', $data)) {
            $object->setUrl($data['url']);
        }
        if (\array_key_exists('contentType', $data)) {
            $object->setContentType($data['contentType']);
        }
        if (\array_key_exists('sizeBytes', $data)) {
            $object->setSizeBytes($data['sizeBytes']);
        }
        if (\array_key_exists('width', $data) && $data['width'] !== null) {
            $object->setWidth($data['width']);
        }
        elseif (\array_key_exists('width', $data) && $data['width'] === null) {
            $object->setWidth(null);
        }
        if (\array_key_exists('height', $data) && $data['height'] !== null) {
            $object->setHeight($data['height']);
        }
        elseif (\array_key_exists('height', $data) && $data['height'] === null) {
            $object->setHeight(null);
        }
        if (\array_key_exists('createdBy', $data) && $data['createdBy'] !== null) {
            $object->setCreatedBy($data['createdBy']);
        }
        elseif (\array_key_exists('createdBy', $data) && $data['createdBy'] === null) {
            $object->setCreatedBy(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['kind'] = $data->getKind();
        $dataArray['name'] = $data->getName();
        $dataArray['url'] = $data->getUrl();
        $dataArray['contentType'] = $data->getContentType();
        $dataArray['sizeBytes'] = $data->getSizeBytes();
        $dataArray['width'] = $data->getWidth();
        $dataArray['height'] = $data->getHeight();
        $dataArray['createdBy'] = $data->getCreatedBy();
        $dataArray['createdAt'] = $data->getCreatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AssetJsonEncoding::class => false];
    }
}