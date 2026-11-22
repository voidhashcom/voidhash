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
class PaywallBuildJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isDeployed', $data) && \is_int($data['isDeployed'])) {
            $data['isDeployed'] = (bool) $data['isDeployed'];
        }
        if (\array_key_exists('isDeployedInTest', $data) && \is_int($data['isDeployedInTest'])) {
            $data['isDeployedInTest'] = (bool) $data['isDeployedInTest'];
        }
        if (\array_key_exists('isWithdrawn', $data) && \is_int($data['isWithdrawn'])) {
            $data['isWithdrawn'] = (bool) $data['isWithdrawn'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('paywallId', $data)) {
            $object->setPaywallId($data['paywallId']);
        }
        if (\array_key_exists('number', $data)) {
            $object->setNumber($data['number']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('documentVersion', $data) && $data['documentVersion'] !== null) {
            $object->setDocumentVersion($data['documentVersion']);
        }
        elseif (\array_key_exists('documentVersion', $data) && $data['documentVersion'] === null) {
            $object->setDocumentVersion(null);
        }
        if (\array_key_exists('isDeployed', $data)) {
            $object->setIsDeployed($data['isDeployed']);
        }
        if (\array_key_exists('deployedAt', $data) && $data['deployedAt'] !== null) {
            $object->setDeployedAt($data['deployedAt']);
        }
        elseif (\array_key_exists('deployedAt', $data) && $data['deployedAt'] === null) {
            $object->setDeployedAt(null);
        }
        if (\array_key_exists('isDeployedInTest', $data)) {
            $object->setIsDeployedInTest($data['isDeployedInTest']);
        }
        if (\array_key_exists('deployedToTestAt', $data) && $data['deployedToTestAt'] !== null) {
            $object->setDeployedToTestAt($data['deployedToTestAt']);
        }
        elseif (\array_key_exists('deployedToTestAt', $data) && $data['deployedToTestAt'] === null) {
            $object->setDeployedToTestAt(null);
        }
        if (\array_key_exists('flowPackage', $data)) {
            $object->setFlowPackage($this->denormalizer->denormalize($data['flowPackage'], \Voidhash\Generated\Core\Model\FlowPackage::class, 'json', $context));
        }
        if (\array_key_exists('testArms', $data)) {
            $values = [];
            foreach ($data['testArms'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\PaywallBuildTestArm::class, 'json', $context);
            }
            $object->setTestArms($values);
        }
        if (\array_key_exists('isWithdrawn', $data)) {
            $object->setIsWithdrawn($data['isWithdrawn']);
        }
        if (\array_key_exists('withdrawnAt', $data) && $data['withdrawnAt'] !== null) {
            $object->setWithdrawnAt($data['withdrawnAt']);
        }
        elseif (\array_key_exists('withdrawnAt', $data) && $data['withdrawnAt'] === null) {
            $object->setWithdrawnAt(null);
        }
        if (\array_key_exists('failure', $data)) {
            $object->setFailure($this->denormalizer->denormalize($data['failure'], \Voidhash\Generated\Core\Model\PaywallBuildFailure::class, 'json', $context));
        }
        if (\array_key_exists('missingTranslations', $data)) {
            $values_1 = [];
            foreach ($data['missingTranslations'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\PaywallBuildMissingTranslation::class, 'json', $context);
            }
            $object->setMissingTranslations($values_1);
        }
        if (\array_key_exists('createdByUserId', $data) && $data['createdByUserId'] !== null) {
            $object->setCreatedByUserId($data['createdByUserId']);
        }
        elseif (\array_key_exists('createdByUserId', $data) && $data['createdByUserId'] === null) {
            $object->setCreatedByUserId(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('finishedAt', $data) && $data['finishedAt'] !== null) {
            $object->setFinishedAt($data['finishedAt']);
        }
        elseif (\array_key_exists('finishedAt', $data) && $data['finishedAt'] === null) {
            $object->setFinishedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['paywallId'] = $data->getPaywallId();
        $dataArray['number'] = $data->getNumber();
        $dataArray['status'] = $data->getStatus();
        $dataArray['documentVersion'] = $data->getDocumentVersion();
        $dataArray['isDeployed'] = $data->getIsDeployed();
        $dataArray['deployedAt'] = $data->getDeployedAt();
        $dataArray['isDeployedInTest'] = $data->getIsDeployedInTest();
        $dataArray['deployedToTestAt'] = $data->getDeployedToTestAt();
        $dataArray['flowPackage'] = $this->normalizer->normalize($data->getFlowPackage(), 'json', $context);
        $values = [];
        foreach ($data->getTestArms() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['testArms'] = $values;
        $dataArray['isWithdrawn'] = $data->getIsWithdrawn();
        $dataArray['withdrawnAt'] = $data->getWithdrawnAt();
        $dataArray['failure'] = $this->normalizer->normalize($data->getFailure(), 'json', $context);
        $values_1 = [];
        foreach ($data->getMissingTranslations() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['missingTranslations'] = $values_1;
        $dataArray['createdByUserId'] = $data->getCreatedByUserId();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['finishedAt'] = $data->getFinishedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding::class => false];
    }
}