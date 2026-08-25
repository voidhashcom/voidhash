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
class PaywallDeployJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallDeployJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallDeployJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallDeployJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('cliVersion', $data)) {
            $object->setCliVersion($data['cliVersion']);
        }
        if (\array_key_exists('components', $data)) {
            $values = [];
            foreach ($data['components'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\PaywallDeployJsonEncodingComponentsItem::class, 'json', $context);
            }
            $object->setComponents($values);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('createdByName', $data)) {
            $object->setCreatedByName($data['createdByName']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('paywalls', $data)) {
            $values_1 = [];
            foreach ($data['paywalls'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\PaywallDeployJsonEncodingPaywallsItem::class, 'json', $context);
            }
            $object->setPaywalls($values_1);
        }
        if (\array_key_exists('runtimeVersion', $data)) {
            $object->setRuntimeVersion($data['runtimeVersion']);
        }
        if (\array_key_exists('schemaVersion', $data)) {
            $object->setSchemaVersion($data['schemaVersion']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['cliVersion'] = $data->getCliVersion();
        $values = [];
        foreach ($data->getComponents() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['components'] = $values;
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['createdByName'] = $data->getCreatedByName();
        $dataArray['id'] = $data->getId();
        $values_1 = [];
        foreach ($data->getPaywalls() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['paywalls'] = $values_1;
        $dataArray['runtimeVersion'] = $data->getRuntimeVersion();
        $dataArray['schemaVersion'] = $data->getSchemaVersion();
        $dataArray['status'] = $data->getStatus();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallDeployJsonEncoding::class => false];
    }
}