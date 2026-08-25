<?php

namespace Voidhash\Generated\Core\Exception;

class PaymentProviderConfigurationsGetPaymentProviderConfigurationNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding
     */
    private $apiPaymentProviderConfigurationNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding $apiPaymentProviderConfigurationNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaymentProviderConfigurationNotFoundError');
        $this->apiPaymentProviderConfigurationNotFoundErrorJsonEncoding = $apiPaymentProviderConfigurationNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaymentProviderConfigurationNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding
    {
        return $this->apiPaymentProviderConfigurationNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}