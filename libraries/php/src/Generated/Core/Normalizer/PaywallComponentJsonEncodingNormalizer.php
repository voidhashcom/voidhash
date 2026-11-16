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
class PaywallComponentJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding();
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
        if (\array_key_exists('slug', $data)) {
            $object->setSlug($data['slug']);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('category', $data) && $data['category'] !== null) {
            $object->setCategory($data['category']);
        }
        elseif (\array_key_exists('category', $data) && $data['category'] === null) {
            $object->setCategory(null);
        }
        if (\array_key_exists('latestVersion', $data)) {
            $object->setLatestVersion($this->denormalizer->denormalize($data['latestVersion'], \Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding::class, 'json', $context));
        }
        if (\array_key_exists('latestReadyVersion', $data)) {
            $object->setLatestReadyVersion($this->denormalizer->denormalize($data['latestReadyVersion'], \Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding::class, 'json', $context));
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('updatedAt', $data)) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['slug'] = $data->getSlug();
        $dataArray['title'] = $data->getTitle();
        $dataArray['category'] = $data->getCategory();
        $dataArray['latestVersion'] = $this->normalizer->normalize($data->getLatestVersion(), 'json', $context);
        $dataArray['latestReadyVersion'] = $this->normalizer->normalize($data->getLatestReadyVersion(), 'json', $context);
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding::class => false];
    }
}