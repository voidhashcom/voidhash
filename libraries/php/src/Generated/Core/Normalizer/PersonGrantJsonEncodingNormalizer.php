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
class PersonGrantJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PersonGrantJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PersonGrantJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PersonGrantJsonEncoding();
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
        if (\array_key_exists('personId', $data)) {
            $object->setPersonId($data['personId']);
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
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('expiresAt', $data) && $data['expiresAt'] !== null) {
            $object->setExpiresAt($data['expiresAt']);
        }
        elseif (\array_key_exists('expiresAt', $data) && $data['expiresAt'] === null) {
            $object->setExpiresAt(null);
        }
        if (\array_key_exists('note', $data) && $data['note'] !== null) {
            $object->setNote($data['note']);
        }
        elseif (\array_key_exists('note', $data) && $data['note'] === null) {
            $object->setNote(null);
        }
        if (\array_key_exists('grantedBy', $data)) {
            $object->setGrantedBy($this->denormalizer->denormalize($data['grantedBy'], \Voidhash\Generated\Core\Model\PersonGrantJsonEncodingGrantedBy::class, 'json', $context));
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('revokedAt', $data) && $data['revokedAt'] !== null) {
            $object->setRevokedAt($data['revokedAt']);
        }
        elseif (\array_key_exists('revokedAt', $data) && $data['revokedAt'] === null) {
            $object->setRevokedAt(null);
        }
        if (\array_key_exists('revokedBy', $data)) {
            $object->setRevokedBy($this->denormalizer->denormalize($data['revokedBy'], \Voidhash\Generated\Core\Model\PersonGrantActor::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['personId'] = $data->getPersonId();
        $dataArray['perkId'] = $data->getPerkId();
        $dataArray['perkSlug'] = $data->getPerkSlug();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['status'] = $data->getStatus();
        $dataArray['expiresAt'] = $data->getExpiresAt();
        $dataArray['note'] = $data->getNote();
        $dataArray['grantedBy'] = $this->normalizer->normalize($data->getGrantedBy(), 'json', $context);
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['revokedAt'] = $data->getRevokedAt();
        $dataArray['revokedBy'] = $this->normalizer->normalize($data->getRevokedBy(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PersonGrantJsonEncoding::class => false];
    }
}