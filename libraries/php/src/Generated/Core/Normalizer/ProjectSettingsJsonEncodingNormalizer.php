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
class ProjectSettingsJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('paidAccessSharing', $data)) {
            $object->setPaidAccessSharing($this->denormalizer->denormalize($data['paidAccessSharing'], \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingPaidAccessSharing::class, 'json', $context));
        }
        if (\array_key_exists('storeSandbox', $data)) {
            $object->setStoreSandbox($this->denormalizer->denormalize($data['storeSandbox'], \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingStoreSandbox::class, 'json', $context));
        }
        if (\array_key_exists('ads', $data)) {
            $object->setAds($this->denormalizer->denormalize($data['ads'], \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingAds::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['paidAccessSharing'] = $this->normalizer->normalize($data->getPaidAccessSharing(), 'json', $context);
        $dataArray['storeSandbox'] = $this->normalizer->normalize($data->getStoreSandbox(), 'json', $context);
        $dataArray['ads'] = $this->normalizer->normalize($data->getAds(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding::class => false];
    }
}