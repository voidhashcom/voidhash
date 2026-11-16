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
class AdsPerformanceReportJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding();
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
        if (\array_key_exists('data', $data)) {
            $values = [];
            foreach ($data['data'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsPerformanceRow::class, 'json', $context);
            }
            $object->setData($values);
        }
        if (\array_key_exists('pageInfo', $data)) {
            $object->setPageInfo($this->denormalizer->denormalize($data['pageInfo'], \Voidhash\Generated\Core\Model\PageInfo::class, 'json', $context));
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
            $values_1 = [];
            foreach ($data['warnings'] as $value_1) {
                $value_2 = $value_1;
                if (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'currency_converted') and \array_key_exists('currencies', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningCurrencyConverted::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'no_exchange_rate') and \array_key_exists('currencies', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningNoExchangeRate::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'timezone_differs') and \array_key_exists('accountId', $value_1) and \array_key_exists('accountName', $value_1) and \array_key_exists('timezone', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningTimezoneDiffers::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'sync_pending') and \array_key_exists('accountId', $value_1) and \array_key_exists('accountName', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningSyncPending::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'sync_stopped') and \array_key_exists('accountId', $value_1) and \array_key_exists('accountName', $value_1) and \array_key_exists('reason', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningSyncStopped::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'sync_failed') and \array_key_exists('accountId', $value_1) and \array_key_exists('accountName', $value_1) and \array_key_exists('reason', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningSyncFailed::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'range_includes_today')) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningRangeIncludesToday::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'breakdowns_not_kept') and \array_key_exists('keptFrom', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningBreakdownsNotKept::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'reach_limited') and \array_key_exists('limit', $value_1) and (\array_key_exists('per', $value_1) and ($value_1['per'] == 'object' or $value_1['per'] == 'object_day'))) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningReachLimited::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'reach_unavailable')) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningReachUnavailable::class, 'json', $context);
                } elseif (is_array($value_1) and (\array_key_exists('code', $value_1) and $value_1['code'] == 'too_many_objects') and \array_key_exists('limit', $value_1)) {
                    $value_2 = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsReportWarningTooManyObjects::class, 'json', $context);
                }
                $values_1[] = $value_2;
            }
            $object->setWarnings($values_1);
        }
        if (\array_key_exists('level', $data)) {
            $object->setLevel($data['level']);
        }
        if (\array_key_exists('breakdown', $data)) {
            $object->setBreakdown($data['breakdown']);
        }
        if (\array_key_exists('keyConversion', $data)) {
            $object->setKeyConversion($data['keyConversion']);
        }
        if (\array_key_exists('totals', $data)) {
            $object->setTotals($this->denormalizer->denormalize($data['totals'], \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingTotals::class, 'json', $context));
        }
        if (\array_key_exists('unallocated', $data) && $data['unallocated'] !== null) {
            $object->setUnallocated($this->denormalizer->denormalize($data['unallocated'], \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingUnallocated::class, 'json', $context));
        }
        elseif (\array_key_exists('unallocated', $data) && $data['unallocated'] === null) {
            $object->setUnallocated(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $values = [];
        foreach ($data->getData() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['data'] = $values;
        $dataArray['pageInfo'] = $this->normalizer->normalize($data->getPageInfo(), 'json', $context);
        $dataArray['from'] = $data->getFrom();
        $dataArray['to'] = $data->getTo();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['timezone'] = $data->getTimezone();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['hasMeasuredAccess'] = $data->getHasMeasuredAccess();
        $dataArray['provisionalFrom'] = $data->getProvisionalFrom();
        $values_1 = [];
        foreach ($data->getWarnings() as $value_1) {
            $value_2 = $value_1;
            if (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            } elseif (is_object($value_1)) {
                $value_2 = $this->normalizer->normalize($value_1, 'json', $context);
            }
            $values_1[] = $value_2;
        }
        $dataArray['warnings'] = $values_1;
        $dataArray['level'] = $data->getLevel();
        $dataArray['breakdown'] = $data->getBreakdown();
        $dataArray['keyConversion'] = $data->getKeyConversion();
        $dataArray['totals'] = $this->normalizer->normalize($data->getTotals(), 'json', $context);
        $dataArray['unallocated'] = $this->normalizer->normalize($data->getUnallocated(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding::class => false];
    }
}