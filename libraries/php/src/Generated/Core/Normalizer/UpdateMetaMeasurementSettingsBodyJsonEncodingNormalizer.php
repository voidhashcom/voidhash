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
class UpdateMetaMeasurementSettingsBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isConversionsEnabled', $data) && \is_int($data['isConversionsEnabled'])) {
            $data['isConversionsEnabled'] = (bool) $data['isConversionsEnabled'];
        }
        if (\array_key_exists('installReferrerKey', $data) && $data['installReferrerKey'] !== null) {
            $object->setInstallReferrerKey($data['installReferrerKey']);
        }
        elseif (\array_key_exists('installReferrerKey', $data) && $data['installReferrerKey'] === null) {
            $object->setInstallReferrerKey(null);
        }
        if (\array_key_exists('isConversionsEnabled', $data) && $data['isConversionsEnabled'] !== null) {
            $object->setIsConversionsEnabled($data['isConversionsEnabled']);
        }
        elseif (\array_key_exists('isConversionsEnabled', $data) && $data['isConversionsEnabled'] === null) {
            $object->setIsConversionsEnabled(null);
        }
        if (\array_key_exists('conversionsDatasetId', $data) && $data['conversionsDatasetId'] !== null) {
            $object->setConversionsDatasetId($data['conversionsDatasetId']);
        }
        elseif (\array_key_exists('conversionsDatasetId', $data) && $data['conversionsDatasetId'] === null) {
            $object->setConversionsDatasetId(null);
        }
        if (\array_key_exists('conversionsToken', $data) && $data['conversionsToken'] !== null) {
            $object->setConversionsToken($data['conversionsToken']);
        }
        elseif (\array_key_exists('conversionsToken', $data) && $data['conversionsToken'] === null) {
            $object->setConversionsToken(null);
        }
        if (\array_key_exists('conversionsTestEventCode', $data) && $data['conversionsTestEventCode'] !== null) {
            $object->setConversionsTestEventCode($data['conversionsTestEventCode']);
        }
        elseif (\array_key_exists('conversionsTestEventCode', $data) && $data['conversionsTestEventCode'] === null) {
            $object->setConversionsTestEventCode(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('installReferrerKey')) {
            $dataArray['installReferrerKey'] = $data->getInstallReferrerKey();
        }
        if ($data->isInitialized('isConversionsEnabled')) {
            $dataArray['isConversionsEnabled'] = $data->getIsConversionsEnabled();
        }
        if ($data->isInitialized('conversionsDatasetId')) {
            $dataArray['conversionsDatasetId'] = $data->getConversionsDatasetId();
        }
        if ($data->isInitialized('conversionsToken')) {
            $dataArray['conversionsToken'] = $data->getConversionsToken();
        }
        if ($data->isInitialized('conversionsTestEventCode')) {
            $dataArray['conversionsTestEventCode'] = $data->getConversionsTestEventCode();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding::class => false];
    }
}