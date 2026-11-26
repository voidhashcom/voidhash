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
class AnalyticsAlertJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('threshold', $data) && \is_int($data['threshold'])) {
            $data['threshold'] = (float) $data['threshold'];
        }
        if (\array_key_exists('value', $data) && \is_int($data['value'])) {
            $data['value'] = (float) $data['value'];
        }
        if (\array_key_exists('baseline', $data) && \is_int($data['baseline'])) {
            $data['baseline'] = (float) $data['baseline'];
        }
        if (\array_key_exists('isEnabled', $data) && \is_int($data['isEnabled'])) {
            $data['isEnabled'] = (bool) $data['isEnabled'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('eventName', $data) && $data['eventName'] !== null) {
            $object->setEventName($data['eventName']);
        }
        elseif (\array_key_exists('eventName', $data) && $data['eventName'] === null) {
            $object->setEventName(null);
        }
        if (\array_key_exists('metric', $data)) {
            $object->setMetric($this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsAlertMetric::class, 'json', $context));
        }
        if (\array_key_exists('filters', $data)) {
            $values = [];
            foreach ($data['filters'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsMetricFilter::class, 'json', $context);
            }
            $object->setFilters($values);
        }
        if (\array_key_exists('direction', $data)) {
            $object->setDirection($data['direction']);
        }
        if (\array_key_exists('currency', $data) && $data['currency'] !== null) {
            $object->setCurrency($data['currency']);
        }
        elseif (\array_key_exists('currency', $data) && $data['currency'] === null) {
            $object->setCurrency(null);
        }
        if (\array_key_exists('successEventName', $data) && $data['successEventName'] !== null) {
            $object->setSuccessEventName($data['successEventName']);
        }
        elseif (\array_key_exists('successEventName', $data) && $data['successEventName'] === null) {
            $object->setSuccessEventName(null);
        }
        if (\array_key_exists('windowHours', $data)) {
            $object->setWindowHours($data['windowHours']);
        }
        if (\array_key_exists('threshold', $data)) {
            $object->setThreshold($data['threshold']);
        }
        if (\array_key_exists('minPeople', $data) && $data['minPeople'] !== null) {
            $object->setMinPeople($data['minPeople']);
        }
        elseif (\array_key_exists('minPeople', $data) && $data['minPeople'] === null) {
            $object->setMinPeople(null);
        }
        if (\array_key_exists('isEnabled', $data)) {
            $object->setIsEnabled($data['isEnabled']);
        }
        if (\array_key_exists('state', $data)) {
            $object->setState($data['state']);
        }
        if (\array_key_exists('value', $data) && $data['value'] !== null) {
            $object->setValue($data['value']);
        }
        elseif (\array_key_exists('value', $data) && $data['value'] === null) {
            $object->setValue(null);
        }
        if (\array_key_exists('baseline', $data) && $data['baseline'] !== null) {
            $object->setBaseline($data['baseline']);
        }
        elseif (\array_key_exists('baseline', $data) && $data['baseline'] === null) {
            $object->setBaseline(null);
        }
        if (\array_key_exists('baselineWeeks', $data) && $data['baselineWeeks'] !== null) {
            $object->setBaselineWeeks($data['baselineWeeks']);
        }
        elseif (\array_key_exists('baselineWeeks', $data) && $data['baselineWeeks'] === null) {
            $object->setBaselineWeeks(null);
        }
        if (\array_key_exists('problem', $data) && $data['problem'] !== null) {
            $object->setProblem($data['problem']);
        }
        elseif (\array_key_exists('problem', $data) && $data['problem'] === null) {
            $object->setProblem(null);
        }
        if (\array_key_exists('checkedThrough', $data) && $data['checkedThrough'] !== null) {
            $object->setCheckedThrough($data['checkedThrough']);
        }
        elseif (\array_key_exists('checkedThrough', $data) && $data['checkedThrough'] === null) {
            $object->setCheckedThrough(null);
        }
        if (\array_key_exists('firingSince', $data) && $data['firingSince'] !== null) {
            $object->setFiringSince($data['firingSince']);
        }
        elseif (\array_key_exists('firingSince', $data) && $data['firingSince'] === null) {
            $object->setFiringSince(null);
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
        $dataArray['name'] = $data->getName();
        $dataArray['kind'] = $data->getKind();
        $dataArray['eventName'] = $data->getEventName();
        $dataArray['metric'] = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        $values = [];
        foreach ($data->getFilters() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['filters'] = $values;
        $dataArray['direction'] = $data->getDirection();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['successEventName'] = $data->getSuccessEventName();
        $dataArray['windowHours'] = $data->getWindowHours();
        $dataArray['threshold'] = $data->getThreshold();
        $dataArray['minPeople'] = $data->getMinPeople();
        $dataArray['isEnabled'] = $data->getIsEnabled();
        $dataArray['state'] = $data->getState();
        $dataArray['value'] = $data->getValue();
        $dataArray['baseline'] = $data->getBaseline();
        $dataArray['baselineWeeks'] = $data->getBaselineWeeks();
        $dataArray['problem'] = $data->getProblem();
        $dataArray['checkedThrough'] = $data->getCheckedThrough();
        $dataArray['firingSince'] = $data->getFiringSince();
        $dataArray['createdAt'] = $data->getCreatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding::class => false];
    }
}