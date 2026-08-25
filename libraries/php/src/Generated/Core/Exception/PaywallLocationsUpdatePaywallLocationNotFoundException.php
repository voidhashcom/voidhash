<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallLocationsUpdatePaywallLocationNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallLocationNotFoundErrorJsonEncoding
     */
    private $apiPaywallLocationNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallLocationNotFoundErrorJsonEncoding $apiPaywallLocationNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallLocationNotFoundError');
        $this->apiPaywallLocationNotFoundErrorJsonEncoding = $apiPaywallLocationNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallLocationNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallLocationNotFoundErrorJsonEncoding
    {
        return $this->apiPaywallLocationNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}