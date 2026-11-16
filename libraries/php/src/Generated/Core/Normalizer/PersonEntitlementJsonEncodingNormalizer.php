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
class PersonEntitlementJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('perkId', $data)) {
            $object->setPerkId($data['perkId']);
        }
        if (\array_key_exists('perkSlug', $data) && $data['perkSlug'] !== null) {
            $object->setPerkSlug($data['perkSlug']);
        }
        elseif (\array_key_exists('perkSlug', $data) && $data['perkSlug'] === null) {
            $object->setPerkSlug(null);
        }
        if (\array_key_exists('source', $data)) {
            $object->setSource($data['source']);
        }
        if (\array_key_exists('sourceId', $data) && $data['sourceId'] !== null) {
            $object->setSourceId($data['sourceId']);
        }
        elseif (\array_key_exists('sourceId', $data) && $data['sourceId'] === null) {
            $object->setSourceId(null);
        }
        if (\array_key_exists('sourcePersonId', $data)) {
            $object->setSourcePersonId($data['sourcePersonId']);
        }
        if (\array_key_exists('expiresAt', $data) && $data['expiresAt'] !== null) {
            $object->setExpiresAt($data['expiresAt']);
        }
        elseif (\array_key_exists('expiresAt', $data) && $data['expiresAt'] === null) {
            $object->setExpiresAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['perkId'] = $data->getPerkId();
        $dataArray['perkSlug'] = $data->getPerkSlug();
        $dataArray['source'] = $data->getSource();
        $dataArray['sourceId'] = $data->getSourceId();
        $dataArray['sourcePersonId'] = $data->getSourcePersonId();
        $dataArray['expiresAt'] = $data->getExpiresAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding::class => false];
    }
}