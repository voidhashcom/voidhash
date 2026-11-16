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
class TrackingDomainJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding();
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
        if (\array_key_exists('hostname', $data)) {
            $object->setHostname($data['hostname']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('failureReason', $data) && $data['failureReason'] !== null) {
            $object->setFailureReason($data['failureReason']);
        }
        elseif (\array_key_exists('failureReason', $data) && $data['failureReason'] === null) {
            $object->setFailureReason(null);
        }
        if (\array_key_exists('dnsRecords', $data)) {
            $values = [];
            foreach ($data['dnsRecords'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\TrackingDomainDnsRecordJsonEncoding::class, 'json', $context);
            }
            $object->setDnsRecords($values);
        }
        if (\array_key_exists('lastCheckedAt', $data) && $data['lastCheckedAt'] !== null) {
            $object->setLastCheckedAt($data['lastCheckedAt']);
        }
        elseif (\array_key_exists('lastCheckedAt', $data) && $data['lastCheckedAt'] === null) {
            $object->setLastCheckedAt(null);
        }
        if (\array_key_exists('activatedAt', $data) && $data['activatedAt'] !== null) {
            $object->setActivatedAt($data['activatedAt']);
        }
        elseif (\array_key_exists('activatedAt', $data) && $data['activatedAt'] === null) {
            $object->setActivatedAt(null);
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
        $dataArray['hostname'] = $data->getHostname();
        $dataArray['status'] = $data->getStatus();
        $dataArray['failureReason'] = $data->getFailureReason();
        $values = [];
        foreach ($data->getDnsRecords() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['dnsRecords'] = $values;
        $dataArray['lastCheckedAt'] = $data->getLastCheckedAt();
        $dataArray['activatedAt'] = $data->getActivatedAt();
        $dataArray['createdAt'] = $data->getCreatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding::class => false];
    }
}