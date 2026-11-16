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
class AvailableAdAccountsJsonEncodingTokenNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncodingToken::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncodingToken::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncodingToken();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasRequiredPermission', $data) && \is_int($data['hasRequiredPermission'])) {
            $data['hasRequiredPermission'] = (bool) $data['hasRequiredPermission'];
        }
        if (\array_key_exists('maskedToken', $data)) {
            $object->setMaskedToken($data['maskedToken']);
        }
        if (\array_key_exists('hasRequiredPermission', $data)) {
            $object->setHasRequiredPermission($data['hasRequiredPermission']);
        }
        if (\array_key_exists('permissions', $data)) {
            $values = [];
            foreach ($data['permissions'] as $value) {
                $values[] = $value;
            }
            $object->setPermissions($values);
        }
        if (\array_key_exists('businessName', $data) && $data['businessName'] !== null) {
            $object->setBusinessName($data['businessName']);
        }
        elseif (\array_key_exists('businessName', $data) && $data['businessName'] === null) {
            $object->setBusinessName(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['maskedToken'] = $data->getMaskedToken();
        $dataArray['hasRequiredPermission'] = $data->getHasRequiredPermission();
        $values = [];
        foreach ($data->getPermissions() as $value) {
            $values[] = $value;
        }
        $dataArray['permissions'] = $values;
        $dataArray['businessName'] = $data->getBusinessName();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncodingToken::class => false];
    }
}