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
class WebhookDeliveryAttemptJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('succeeded', $data) && \is_int($data['succeeded'])) {
            $data['succeeded'] = (bool) $data['succeeded'];
        }
        if (\array_key_exists('attemptNumber', $data)) {
            $object->setAttemptNumber($data['attemptNumber']);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('durationMs', $data) && $data['durationMs'] !== null) {
            $object->setDurationMs($data['durationMs']);
        }
        elseif (\array_key_exists('durationMs', $data) && $data['durationMs'] === null) {
            $object->setDurationMs(null);
        }
        if (\array_key_exists('errorMessage', $data) && $data['errorMessage'] !== null) {
            $object->setErrorMessage($data['errorMessage']);
        }
        elseif (\array_key_exists('errorMessage', $data) && $data['errorMessage'] === null) {
            $object->setErrorMessage(null);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('responseBody', $data) && $data['responseBody'] !== null) {
            $object->setResponseBody($data['responseBody']);
        }
        elseif (\array_key_exists('responseBody', $data) && $data['responseBody'] === null) {
            $object->setResponseBody(null);
        }
        if (\array_key_exists('statusCode', $data) && $data['statusCode'] !== null) {
            $object->setStatusCode($data['statusCode']);
        }
        elseif (\array_key_exists('statusCode', $data) && $data['statusCode'] === null) {
            $object->setStatusCode(null);
        }
        if (\array_key_exists('succeeded', $data)) {
            $object->setSucceeded($data['succeeded']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['attemptNumber'] = $data->getAttemptNumber();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['durationMs'] = $data->getDurationMs();
        $dataArray['errorMessage'] = $data->getErrorMessage();
        $dataArray['id'] = $data->getId();
        $dataArray['responseBody'] = $data->getResponseBody();
        $dataArray['statusCode'] = $data->getStatusCode();
        $dataArray['succeeded'] = $data->getSucceeded();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class => false];
    }
}