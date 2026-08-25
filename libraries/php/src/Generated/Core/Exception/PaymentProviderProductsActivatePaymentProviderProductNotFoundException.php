<?php

namespace Voidhash\Generated\Core\Exception;

class PaymentProviderProductsActivatePaymentProviderProductNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding
     */
    private $apiPaymentProviderProductNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding $apiPaymentProviderProductNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaymentProviderProductNotFoundError');
        $this->apiPaymentProviderProductNotFoundErrorJsonEncoding = $apiPaymentProviderProductNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaymentProviderProductNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaymentProviderProductNotFoundErrorJsonEncoding
    {
        return $this->apiPaymentProviderProductNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}