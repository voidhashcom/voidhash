<?php

namespace Voidhash\Generated\Core\Exception;

class PaymentProviderConfigurationsDeletePaymentProviderConfigurationConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationInUseErrorJsonEncoding
     */
    private $apiPaymentProviderConfigurationInUseErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationInUseErrorJsonEncoding $apiPaymentProviderConfigurationInUseErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaymentProviderConfigurationInUseError');
        $this->apiPaymentProviderConfigurationInUseErrorJsonEncoding = $apiPaymentProviderConfigurationInUseErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaymentProviderConfigurationInUseErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationInUseErrorJsonEncoding
    {
        return $this->apiPaymentProviderConfigurationInUseErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}