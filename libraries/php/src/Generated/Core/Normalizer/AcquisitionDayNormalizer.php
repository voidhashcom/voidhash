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
class AcquisitionDayNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AcquisitionDay::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AcquisitionDay::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AcquisitionDay();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('signupToPayerRate', $data) && \is_int($data['signupToPayerRate'])) {
            $data['signupToPayerRate'] = (float) $data['signupToPayerRate'];
        }
        if (\array_key_exists('peopleAcquired', $data)) {
            $object->setPeopleAcquired($data['peopleAcquired']);
        }
        if (\array_key_exists('signups', $data)) {
            $object->setSignups($data['signups']);
        }
        if (\array_key_exists('visits', $data)) {
            $object->setVisits($data['visits']);
        }
        if (\array_key_exists('appInstalls', $data)) {
            $object->setAppInstalls($data['appInstalls']);
        }
        if (\array_key_exists('trialStarters', $data)) {
            $object->setTrialStarters($data['trialStarters']);
        }
        if (\array_key_exists('trialConversions', $data)) {
            $object->setTrialConversions($data['trialConversions']);
        }
        if (\array_key_exists('payingPeople', $data)) {
            $object->setPayingPeople($data['payingPeople']);
        }
        if (\array_key_exists('crossSurfacePayers', $data)) {
            $object->setCrossSurfacePayers($data['crossSurfacePayers']);
        }
        if (\array_key_exists('keyConversions', $data)) {
            $object->setKeyConversions($data['keyConversions']);
        }
        if (\array_key_exists('signupToPayerRate', $data) && $data['signupToPayerRate'] !== null) {
            $object->setSignupToPayerRate($data['signupToPayerRate']);
        }
        elseif (\array_key_exists('signupToPayerRate', $data) && $data['signupToPayerRate'] === null) {
            $object->setSignupToPayerRate(null);
        }
        if (\array_key_exists('returningPeople', $data)) {
            $object->setReturningPeople($data['returningPeople']);
        }
        if (\array_key_exists('returningPayers', $data)) {
            $object->setReturningPayers($data['returningPayers']);
        }
        if (\array_key_exists('returningRevenue', $data)) {
            $object->setReturningRevenue($data['returningRevenue']);
        }
        if (\array_key_exists('grossRevenue', $data)) {
            $object->setGrossRevenue($data['grossRevenue']);
        }
        if (\array_key_exists('refunds', $data)) {
            $object->setRefunds($data['refunds']);
        }
        if (\array_key_exists('netRevenue', $data)) {
            $object->setNetRevenue($data['netRevenue']);
        }
        if (\array_key_exists('date', $data)) {
            $object->setDate($data['date']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['peopleAcquired'] = $data->getPeopleAcquired();
        $dataArray['signups'] = $data->getSignups();
        $dataArray['visits'] = $data->getVisits();
        $dataArray['appInstalls'] = $data->getAppInstalls();
        $dataArray['trialStarters'] = $data->getTrialStarters();
        $dataArray['trialConversions'] = $data->getTrialConversions();
        $dataArray['payingPeople'] = $data->getPayingPeople();
        $dataArray['crossSurfacePayers'] = $data->getCrossSurfacePayers();
        $dataArray['keyConversions'] = $data->getKeyConversions();
        $dataArray['signupToPayerRate'] = $data->getSignupToPayerRate();
        $dataArray['returningPeople'] = $data->getReturningPeople();
        $dataArray['returningPayers'] = $data->getReturningPayers();
        $dataArray['returningRevenue'] = $data->getReturningRevenue();
        $dataArray['grossRevenue'] = $data->getGrossRevenue();
        $dataArray['refunds'] = $data->getRefunds();
        $dataArray['netRevenue'] = $data->getNetRevenue();
        $dataArray['date'] = $data->getDate();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AcquisitionDay::class => false];
    }
}