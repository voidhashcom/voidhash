<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallsUpdatePaywallNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallNotFoundErrorJsonEncoding
     */
    private $apiPaywallNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallNotFoundErrorJsonEncoding $apiPaywallNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallNotFoundError');
        $this->apiPaywallNotFoundErrorJsonEncoding = $apiPaywallNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallNotFoundErrorJsonEncoding
    {
        return $this->apiPaywallNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}