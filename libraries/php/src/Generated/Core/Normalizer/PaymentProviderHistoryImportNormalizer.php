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
class PaymentProviderHistoryImportNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaymentProviderHistoryImport::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaymentProviderHistoryImport::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaymentProviderHistoryImport();
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
        if (\array_key_exists('paymentProviderId', $data)) {
            $object->setPaymentProviderId($data['paymentProviderId']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('phase', $data)) {
            $object->setPhase($data['phase']);
        }
        if (\array_key_exists('cutoffAt', $data)) {
            $object->setCutoffAt($data['cutoffAt']);
        }
        if (\array_key_exists('requestedAt', $data)) {
            $object->setRequestedAt($data['requestedAt']);
        }
        if (\array_key_exists('completedAt', $data) && $data['completedAt'] !== null) {
            $object->setCompletedAt($data['completedAt']);
        }
        elseif (\array_key_exists('completedAt', $data) && $data['completedAt'] === null) {
            $object->setCompletedAt(null);
        }
        if (\array_key_exists('lastError', $data) && $data['lastError'] !== null) {
            $object->setLastError($data['lastError']);
        }
        elseif (\array_key_exists('lastError', $data) && $data['lastError'] === null) {
            $object->setLastError(null);
        }
        if (\array_key_exists('counts', $data)) {
            $object->setCounts($this->denormalizer->denormalize($data['counts'], \Voidhash\Generated\Core\Model\PaymentProviderHistoryImportCounts::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['paymentProviderId'] = $data->getPaymentProviderId();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['status'] = $data->getStatus();
        $dataArray['phase'] = $data->getPhase();
        $dataArray['cutoffAt'] = $data->getCutoffAt();
        $dataArray['requestedAt'] = $data->getRequestedAt();
        $dataArray['completedAt'] = $data->getCompletedAt();
        $dataArray['lastError'] = $data->getLastError();
        $dataArray['counts'] = $this->normalizer->normalize($data->getCounts(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaymentProviderHistoryImport::class => false];
    }
}