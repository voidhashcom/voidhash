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
class UpdateProjectSettingsBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('paidAccessSharing', $data) && $data['paidAccessSharing'] !== null) {
            $object->setPaidAccessSharing($this->denormalizer->denormalize($data['paidAccessSharing'], \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing::class, 'json', $context));
        }
        elseif (\array_key_exists('paidAccessSharing', $data) && $data['paidAccessSharing'] === null) {
            $object->setPaidAccessSharing(null);
        }
        if (\array_key_exists('storeSandbox', $data) && $data['storeSandbox'] !== null) {
            $object->setStoreSandbox($this->denormalizer->denormalize($data['storeSandbox'], \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingStoreSandbox::class, 'json', $context));
        }
        elseif (\array_key_exists('storeSandbox', $data) && $data['storeSandbox'] === null) {
            $object->setStoreSandbox(null);
        }
        if (\array_key_exists('ads', $data) && $data['ads'] !== null) {
            $object->setAds($this->denormalizer->denormalize($data['ads'], \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingAds::class, 'json', $context));
        }
        elseif (\array_key_exists('ads', $data) && $data['ads'] === null) {
            $object->setAds(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('paidAccessSharing')) {
            $dataArray['paidAccessSharing'] = $this->normalizer->normalize($data->getPaidAccessSharing(), 'json', $context);
        }
        if ($data->isInitialized('storeSandbox')) {
            $dataArray['storeSandbox'] = $this->normalizer->normalize($data->getStoreSandbox(), 'json', $context);
        }
        if ($data->isInitialized('ads')) {
            $dataArray['ads'] = $this->normalizer->normalize($data->getAds(), 'json', $context);
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding::class => false];
    }
}