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
class AdsChangesReportJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('since', $data)) {
            $object->setSince($data['since']);
        }
        if (\array_key_exists('until', $data)) {
            $object->setUntil($data['until']);
        }
        if (\array_key_exists('level', $data)) {
            $object->setLevel($data['level']);
        }
        if (\array_key_exists('accounts', $data)) {
            $values = [];
            foreach ($data['accounts'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncodingAccountsItem::class, 'json', $context);
            }
            $object->setAccounts($values);
        }
        if (\array_key_exists('decisions', $data)) {
            $values_1 = [];
            foreach ($data['decisions'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsDecision::class, 'json', $context);
            }
            $object->setDecisions($values_1);
        }
        if (\array_key_exists('delivery', $data)) {
            $values_2 = [];
            foreach ($data['delivery'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\AdsDeliveryChange::class, 'json', $context);
            }
            $object->setDelivery($values_2);
        }
        if (\array_key_exists('revisions', $data)) {
            $values_3 = [];
            foreach ($data['revisions'] as $value_3) {
                $values_3[] = $this->denormalizer->denormalize($value_3, \Voidhash\Generated\Core\Model\AdsRevision::class, 'json', $context);
            }
            $object->setRevisions($values_3);
        }
        if (\array_key_exists('warnings', $data)) {
            $values_4 = [];
            foreach ($data['warnings'] as $value_4) {
                $value_5 = $value_4;
                if (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'currency_converted') and \array_key_exists('currencies', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningCurrencyConverted::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'no_exchange_rate') and \array_key_exists('currencies', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningNoExchangeRate::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'timezone_differs') and \array_key_exists('accountId', $value_4) and \array_key_exists('accountName', $value_4) and \array_key_exists('timezone', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningTimezoneDiffers::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'sync_pending') and \array_key_exists('accountId', $value_4) and \array_key_exists('accountName', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningSyncPending::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'sync_stopped') and \array_key_exists('accountId', $value_4) and \array_key_exists('accountName', $value_4) and \array_key_exists('reason', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningSyncStopped::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'sync_failed') and \array_key_exists('accountId', $value_4) and \array_key_exists('accountName', $value_4) and \array_key_exists('reason', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningSyncFailed::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'range_includes_today')) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningRangeIncludesToday::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'breakdowns_not_kept') and \array_key_exists('keptFrom', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningBreakdownsNotKept::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'reach_limited') and \array_key_exists('limit', $value_4) and (\array_key_exists('per', $value_4) and ($value_4['per'] == 'object' or $value_4['per'] == 'object_day'))) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningReachLimited::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'reach_unavailable')) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningReachUnavailable::class, 'json', $context);
                } elseif (is_array($value_4) and (\array_key_exists('code', $value_4) and $value_4['code'] == 'too_many_objects') and \array_key_exists('limit', $value_4)) {
                    $value_5 = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\AdsReportWarningTooManyObjects::class, 'json', $context);
                }
                $values_4[] = $value_5;
            }
            $object->setWarnings($values_4);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['since'] = $data->getSince();
        $dataArray['until'] = $data->getUntil();
        $dataArray['level'] = $data->getLevel();
        $values = [];
        foreach ($data->getAccounts() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['accounts'] = $values;
        $values_1 = [];
        foreach ($data->getDecisions() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['decisions'] = $values_1;
        $values_2 = [];
        foreach ($data->getDelivery() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['delivery'] = $values_2;
        $values_3 = [];
        foreach ($data->getRevisions() as $value_3) {
            $values_3[] = $this->normalizer->normalize($value_3, 'json', $context);
        }
        $dataArray['revisions'] = $values_3;
        $values_4 = [];
        foreach ($data->getWarnings() as $value_4) {
            $value_5 = $value_4;
            if (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            } elseif (is_object($value_4)) {
                $value_5 = $this->normalizer->normalize($value_4, 'json', $context);
            }
            $values_4[] = $value_5;
        }
        $dataArray['warnings'] = $values_4;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsChangesReportJsonEncoding::class => false];
    }
}