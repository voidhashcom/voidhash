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
class ConnectedAppJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isReadOnly', $data) && \is_int($data['isReadOnly'])) {
            $data['isReadOnly'] = (bool) $data['isReadOnly'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('clientName', $data)) {
            $object->setClientName($data['clientName']);
        }
        if (\array_key_exists('reportedName', $data) && $data['reportedName'] !== null) {
            $object->setReportedName($data['reportedName']);
        }
        elseif (\array_key_exists('reportedName', $data) && $data['reportedName'] === null) {
            $object->setReportedName(null);
        }
        if (\array_key_exists('device', $data) && $data['device'] !== null) {
            $object->setDevice($data['device']);
        }
        elseif (\array_key_exists('device', $data) && $data['device'] === null) {
            $object->setDevice(null);
        }
        if (\array_key_exists('isReadOnly', $data)) {
            $object->setIsReadOnly($data['isReadOnly']);
        }
        if (\array_key_exists('connectedAt', $data)) {
            $object->setConnectedAt($data['connectedAt']);
        }
        if (\array_key_exists('lastUsedAt', $data)) {
            $object->setLastUsedAt($data['lastUsedAt']);
        }
        if (\array_key_exists('idleExpiresAt', $data)) {
            $object->setIdleExpiresAt($data['idleExpiresAt']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['kind'] = $data->getKind();
        $dataArray['clientName'] = $data->getClientName();
        $dataArray['reportedName'] = $data->getReportedName();
        $dataArray['device'] = $data->getDevice();
        $dataArray['isReadOnly'] = $data->getIsReadOnly();
        $dataArray['connectedAt'] = $data->getConnectedAt();
        $dataArray['lastUsedAt'] = $data->getLastUsedAt();
        $dataArray['idleExpiresAt'] = $data->getIdleExpiresAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding::class => false];
    }
}