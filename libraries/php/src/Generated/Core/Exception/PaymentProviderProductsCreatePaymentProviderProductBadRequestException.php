<?php

namespace Voidhash\Generated\Core\Exception;

class PaymentProviderProductsCreatePaymentProviderProductBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding
     */
    private $apiPaymentProviderProductValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding $apiPaymentProviderProductValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaymentProviderProductValidationError');
        $this->apiPaymentProviderProductValidationErrorJsonEncoding = $apiPaymentProviderProductValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaymentProviderProductValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaymentProviderProductValidationErrorJsonEncoding
    {
        return $this->apiPaymentProviderProductValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}