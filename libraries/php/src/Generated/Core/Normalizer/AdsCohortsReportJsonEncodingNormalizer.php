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
class AdsCohortsReportJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasMeasuredAccess', $data) && \is_int($data['hasMeasuredAccess'])) {
            $data['hasMeasuredAccess'] = (bool) $data['hasMeasuredAccess'];
        }
        if (\array_key_exists('from', $data)) {
            $object->setFrom($data['from']);
        }
        if (\array_key_exists('to', $data)) {
            $object->setTo($data['to']);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('timezone', $data)) {
            $object->setTimezone($data['timezone']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('hasMeasuredAccess', $data)) {
            $object->setHasMeasuredAccess($data['hasMeasuredAccess']);
        }
        if (\array_key_exists('provisionalFrom', $data) && $data['provisionalFrom'] !== null) {
            $object->setProvisionalFrom($data['provisionalFrom']);
        }
        elseif (\array_key_exists('provisionalFrom', $data) && $data['provisionalFrom'] === null) {
            $object->setProvisionalFrom(null);
        }
        if (\array_key_exists('warnings', $data)) {
            $values = [];
            foreach ($data['warnings'] as $value) {
                $value_1 = $value;
                if (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'currency_converted') and \array_key_exists('currencies', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningCurrencyConverted::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'no_exchange_rate') and \array_key_exists('currencies', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningNoExchangeRate::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'timezone_differs') and \array_key_exists('accountId', $value) and \array_key_exists('accountName', $value) and \array_key_exists('timezone', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningTimezoneDiffers::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'sync_pending') and \array_key_exists('accountId', $value) and \array_key_exists('accountName', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningSyncPending::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'sync_stopped') and \array_key_exists('accountId', $value) and \array_key_exists('accountName', $value) and \array_key_exists('reason', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningSyncStopped::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'sync_failed') and \array_key_exists('accountId', $value) and \array_key_exists('accountName', $value) and \array_key_exists('reason', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningSyncFailed::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'range_includes_today')) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningRangeIncludesToday::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'breakdowns_not_kept') and \array_key_exists('keptFrom', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningBreakdownsNotKept::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'reach_limited') and \array_key_exists('limit', $value) and (\array_key_exists('per', $value) and ($value['per'] == 'object' or $value['per'] == 'object_day'))) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningReachLimited::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'reach_unavailable')) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningReachUnavailable::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('code', $value) and $value['code'] == 'too_many_objects') and \array_key_exists('limit', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportWarningTooManyObjects::class, 'json', $context);
                }
                $values[] = $value_1;
            }
            $object->setWarnings($values);
        }
        if (\array_key_exists('groupBy', $data)) {
            $object->setGroupBy($data['groupBy']);
        }
        if (\array_key_exists('unit', $data)) {
            $object->setUnit($data['unit']);
        }
        if (\array_key_exists('metric', $data)) {
            $object->setMetric($data['metric']);
        }
        if (\array_key_exists('cohorts', $data)) {
            $values_1 = [];
            foreach ($data['cohorts'] as $value_2) {
                $values_1[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItem::class, 'json', $context);
            }
            $object->setCohorts($values_1);
        }
        if (\array_key_exists('average', $data)) {
            $object->setAverage($this->denormalizer->denormalize($data['average'], \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingAverage::class, 'json', $context));
        }
        if (\array_key_exists('groups', $data)) {
            $values_2 = [];
            foreach ($data['groups'] as $value_3) {
                $values_2[] = $this->denormalizer->denormalize($value_3, \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingGroupsItem::class, 'json', $context);
            }
            $object->setGroups($values_2);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['from'] = $data->getFrom();
        $dataArray['to'] = $data->getTo();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['timezone'] = $data->getTimezone();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['hasMeasuredAccess'] = $data->getHasMeasuredAccess();
        $dataArray['provisionalFrom'] = $data->getProvisionalFrom();
        $values = [];
        foreach ($data->getWarnings() as $value) {
            $value_1 = $value;
            if (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            }
            $values[] = $value_1;
        }
        $dataArray['warnings'] = $values;
        $dataArray['groupBy'] = $data->getGroupBy();
        $dataArray['unit'] = $data->getUnit();
        $dataArray['metric'] = $data->getMetric();
        $values_1 = [];
        foreach ($data->getCohorts() as $value_2) {
            $values_1[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['cohorts'] = $values_1;
        $dataArray['average'] = $this->normalizer->normalize($data->getAverage(), 'json', $context);
        $values_2 = [];
        foreach ($data->getGroups() as $value_3) {
            $values_2[] = $this->normalizer->normalize($value_3, 'json', $context);
        }
        $dataArray['groups'] = $values_2;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncoding::class => false];
    }
}