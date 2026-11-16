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
class AdsMeasuredMetricsNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsMeasuredMetrics::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsMeasuredMetrics::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsMeasuredMetrics();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('roas', $data) && \is_int($data['roas'])) {
            $data['roas'] = (float) $data['roas'];
        }
        if (\array_key_exists('visits', $data) && $data['visits'] !== null) {
            $object->setVisits($data['visits']);
        }
        elseif (\array_key_exists('visits', $data) && $data['visits'] === null) {
            $object->setVisits(null);
        }
        if (\array_key_exists('installs', $data) && $data['installs'] !== null) {
            $object->setInstalls($data['installs']);
        }
        elseif (\array_key_exists('installs', $data) && $data['installs'] === null) {
            $object->setInstalls(null);
        }
        if (\array_key_exists('signups', $data)) {
            $object->setSignups($data['signups']);
        }
        if (\array_key_exists('trials', $data) && $data['trials'] !== null) {
            $object->setTrials($data['trials']);
        }
        elseif (\array_key_exists('trials', $data) && $data['trials'] === null) {
            $object->setTrials(null);
        }
        if (\array_key_exists('payers', $data)) {
            $object->setPayers($data['payers']);
        }
        if (\array_key_exists('keyConversions', $data)) {
            $object->setKeyConversions($data['keyConversions']);
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
        if (\array_key_exists('roas', $data) && $data['roas'] !== null) {
            $object->setRoas($data['roas']);
        }
        elseif (\array_key_exists('roas', $data) && $data['roas'] === null) {
            $object->setRoas(null);
        }
        if (\array_key_exists('costPerSignup', $data) && $data['costPerSignup'] !== null) {
            $object->setCostPerSignup($data['costPerSignup']);
        }
        elseif (\array_key_exists('costPerSignup', $data) && $data['costPerSignup'] === null) {
            $object->setCostPerSignup(null);
        }
        if (\array_key_exists('costPerPayer', $data) && $data['costPerPayer'] !== null) {
            $object->setCostPerPayer($data['costPerPayer']);
        }
        elseif (\array_key_exists('costPerPayer', $data) && $data['costPerPayer'] === null) {
            $object->setCostPerPayer(null);
        }
        if (\array_key_exists('costPerKeyConversion', $data) && $data['costPerKeyConversion'] !== null) {
            $object->setCostPerKeyConversion($data['costPerKeyConversion']);
        }
        elseif (\array_key_exists('costPerKeyConversion', $data) && $data['costPerKeyConversion'] === null) {
            $object->setCostPerKeyConversion(null);
        }
        if (\array_key_exists('returningPayers', $data) && $data['returningPayers'] !== null) {
            $object->setReturningPayers($data['returningPayers']);
        }
        elseif (\array_key_exists('returningPayers', $data) && $data['returningPayers'] === null) {
            $object->setReturningPayers(null);
        }
        if (\array_key_exists('returningRevenue', $data) && $data['returningRevenue'] !== null) {
            $object->setReturningRevenue($data['returningRevenue']);
        }
        elseif (\array_key_exists('returningRevenue', $data) && $data['returningRevenue'] === null) {
            $object->setReturningRevenue(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['visits'] = $data->getVisits();
        $dataArray['installs'] = $data->getInstalls();
        $dataArray['signups'] = $data->getSignups();
        $dataArray['trials'] = $data->getTrials();
        $dataArray['payers'] = $data->getPayers();
        $dataArray['keyConversions'] = $data->getKeyConversions();
        $dataArray['grossRevenue'] = $data->getGrossRevenue();
        $dataArray['refunds'] = $data->getRefunds();
        $dataArray['netRevenue'] = $data->getNetRevenue();
        $dataArray['roas'] = $data->getRoas();
        $dataArray['costPerSignup'] = $data->getCostPerSignup();
        $dataArray['costPerPayer'] = $data->getCostPerPayer();
        $dataArray['costPerKeyConversion'] = $data->getCostPerKeyConversion();
        $dataArray['returningPayers'] = $data->getReturningPayers();
        $dataArray['returningRevenue'] = $data->getReturningRevenue();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsMeasuredMetrics::class => false];
    }
}