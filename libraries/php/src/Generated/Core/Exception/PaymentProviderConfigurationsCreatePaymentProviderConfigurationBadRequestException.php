<?php

namespace Voidhash\Generated\Core\Exception;

class PaymentProviderConfigurationsCreatePaymentProviderConfigurationBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationValidationErrorJsonEncoding
     */
    private $apiPaymentProviderConfigurationValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationValidationErrorJsonEncoding $apiPaymentProviderConfigurationValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaymentProviderConfigurationValidationError');
        $this->apiPaymentProviderConfigurationValidationErrorJsonEncoding = $apiPaymentProviderConfigurationValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaymentProviderConfigurationValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationValidationErrorJsonEncoding
    {
        return $this->apiPaymentProviderConfigurationValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}