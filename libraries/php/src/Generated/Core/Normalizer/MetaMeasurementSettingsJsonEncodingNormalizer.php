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
class MetaMeasurementSettingsJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasInstallReferrerKey', $data) && \is_int($data['hasInstallReferrerKey'])) {
            $data['hasInstallReferrerKey'] = (bool) $data['hasInstallReferrerKey'];
        }
        if (\array_key_exists('isConversionsEnabled', $data) && \is_int($data['isConversionsEnabled'])) {
            $data['isConversionsEnabled'] = (bool) $data['isConversionsEnabled'];
        }
        if (\array_key_exists('hasConversionsToken', $data) && \is_int($data['hasConversionsToken'])) {
            $data['hasConversionsToken'] = (bool) $data['hasConversionsToken'];
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('hasInstallReferrerKey', $data)) {
            $object->setHasInstallReferrerKey($data['hasInstallReferrerKey']);
        }
        if (\array_key_exists('installReferrerLastError', $data) && $data['installReferrerLastError'] !== null) {
            $object->setInstallReferrerLastError($data['installReferrerLastError']);
        }
        elseif (\array_key_exists('installReferrerLastError', $data) && $data['installReferrerLastError'] === null) {
            $object->setInstallReferrerLastError(null);
        }
        if (\array_key_exists('installReferrerLastErrorAt', $data) && $data['installReferrerLastErrorAt'] !== null) {
            $object->setInstallReferrerLastErrorAt($data['installReferrerLastErrorAt']);
        }
        elseif (\array_key_exists('installReferrerLastErrorAt', $data) && $data['installReferrerLastErrorAt'] === null) {
            $object->setInstallReferrerLastErrorAt(null);
        }
        if (\array_key_exists('isConversionsEnabled', $data)) {
            $object->setIsConversionsEnabled($data['isConversionsEnabled']);
        }
        if (\array_key_exists('conversionsDatasetId', $data) && $data['conversionsDatasetId'] !== null) {
            $object->setConversionsDatasetId($data['conversionsDatasetId']);
        }
        elseif (\array_key_exists('conversionsDatasetId', $data) && $data['conversionsDatasetId'] === null) {
            $object->setConversionsDatasetId(null);
        }
        if (\array_key_exists('hasConversionsToken', $data)) {
            $object->setHasConversionsToken($data['hasConversionsToken']);
        }
        if (\array_key_exists('conversionsTestEventCode', $data) && $data['conversionsTestEventCode'] !== null) {
            $object->setConversionsTestEventCode($data['conversionsTestEventCode']);
        }
        elseif (\array_key_exists('conversionsTestEventCode', $data) && $data['conversionsTestEventCode'] === null) {
            $object->setConversionsTestEventCode(null);
        }
        if (\array_key_exists('conversionsLastSentAt', $data) && $data['conversionsLastSentAt'] !== null) {
            $object->setConversionsLastSentAt($data['conversionsLastSentAt']);
        }
        elseif (\array_key_exists('conversionsLastSentAt', $data) && $data['conversionsLastSentAt'] === null) {
            $object->setConversionsLastSentAt(null);
        }
        if (\array_key_exists('conversionsLastRunAt', $data) && $data['conversionsLastRunAt'] !== null) {
            $object->setConversionsLastRunAt($data['conversionsLastRunAt']);
        }
        elseif (\array_key_exists('conversionsLastRunAt', $data) && $data['conversionsLastRunAt'] === null) {
            $object->setConversionsLastRunAt(null);
        }
        if (\array_key_exists('conversionsLastError', $data) && $data['conversionsLastError'] !== null) {
            $object->setConversionsLastError($data['conversionsLastError']);
        }
        elseif (\array_key_exists('conversionsLastError', $data) && $data['conversionsLastError'] === null) {
            $object->setConversionsLastError(null);
        }
        if (\array_key_exists('conversionsLastErrorAt', $data) && $data['conversionsLastErrorAt'] !== null) {
            $object->setConversionsLastErrorAt($data['conversionsLastErrorAt']);
        }
        elseif (\array_key_exists('conversionsLastErrorAt', $data) && $data['conversionsLastErrorAt'] === null) {
            $object->setConversionsLastErrorAt(null);
        }
        if (\array_key_exists('conversionsLastErrorKind', $data) && $data['conversionsLastErrorKind'] !== null) {
            $object->setConversionsLastErrorKind($data['conversionsLastErrorKind']);
        }
        elseif (\array_key_exists('conversionsLastErrorKind', $data) && $data['conversionsLastErrorKind'] === null) {
            $object->setConversionsLastErrorKind(null);
        }
        if (\array_key_exists('conversionsSkippedTotal', $data)) {
            $object->setConversionsSkippedTotal($data['conversionsSkippedTotal']);
        }
        if (\array_key_exists('conversionsRefusedInARow', $data)) {
            $object->setConversionsRefusedInARow($data['conversionsRefusedInARow']);
        }
        if (\array_key_exists('conversionsWithheld', $data)) {
            $object->setConversionsWithheld($this->denormalizer->denormalize($data['conversionsWithheld'], \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncodingConversionsWithheld::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['hasInstallReferrerKey'] = $data->getHasInstallReferrerKey();
        $dataArray['installReferrerLastError'] = $data->getInstallReferrerLastError();
        $dataArray['installReferrerLastErrorAt'] = $data->getInstallReferrerLastErrorAt();
        $dataArray['isConversionsEnabled'] = $data->getIsConversionsEnabled();
        $dataArray['conversionsDatasetId'] = $data->getConversionsDatasetId();
        $dataArray['hasConversionsToken'] = $data->getHasConversionsToken();
        $dataArray['conversionsTestEventCode'] = $data->getConversionsTestEventCode();
        $dataArray['conversionsLastSentAt'] = $data->getConversionsLastSentAt();
        $dataArray['conversionsLastRunAt'] = $data->getConversionsLastRunAt();
        $dataArray['conversionsLastError'] = $data->getConversionsLastError();
        $dataArray['conversionsLastErrorAt'] = $data->getConversionsLastErrorAt();
        $dataArray['conversionsLastErrorKind'] = $data->getConversionsLastErrorKind();
        $dataArray['conversionsSkippedTotal'] = $data->getConversionsSkippedTotal();
        $dataArray['conversionsRefusedInARow'] = $data->getConversionsRefusedInARow();
        $dataArray['conversionsWithheld'] = $this->normalizer->normalize($data->getConversionsWithheld(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding::class => false];
    }
}