<?php

namespace Voidhash\Generated\Core\Exception;

class PaymentProviderConfigurationsCreatePaymentProviderConfigurationConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaymentProviderAlreadyExistsErrorJsonEncoding
     */
    private $apiPaymentProviderAlreadyExistsErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaymentProviderAlreadyExistsErrorJsonEncoding $apiPaymentProviderAlreadyExistsErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaymentProviderAlreadyExistsError');
        $this->apiPaymentProviderAlreadyExistsErrorJsonEncoding = $apiPaymentProviderAlreadyExistsErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaymentProviderAlreadyExistsErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaymentProviderAlreadyExistsErrorJsonEncoding
    {
        return $this->apiPaymentProviderAlreadyExistsErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}