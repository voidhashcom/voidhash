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
class TrackingHealthResultJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('start', $data)) {
            $object->setStart($data['start']);
        }
        if (\array_key_exists('end', $data)) {
            $object->setEnd($data['end']);
        }
        if (\array_key_exists('web', $data)) {
            $object->setWeb($this->denormalizer->denormalize($data['web'], \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingWeb::class, 'json', $context));
        }
        if (\array_key_exists('apps', $data)) {
            $values = [];
            foreach ($data['apps'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingAppsItem::class, 'json', $context);
            }
            $object->setApps($values);
        }
        if (\array_key_exists('handoff', $data)) {
            $object->setHandoff($this->denormalizer->denormalize($data['handoff'], \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingHandoff::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['start'] = $data->getStart();
        $dataArray['end'] = $data->getEnd();
        $dataArray['web'] = $this->normalizer->normalize($data->getWeb(), 'json', $context);
        $values = [];
        foreach ($data->getApps() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['apps'] = $values;
        $dataArray['handoff'] = $this->normalizer->normalize($data->getHandoff(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncoding::class => false];
    }
}