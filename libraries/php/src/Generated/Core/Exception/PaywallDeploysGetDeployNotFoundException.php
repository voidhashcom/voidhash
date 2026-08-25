<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallDeploysGetDeployNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding
     */
    private $apiPaywallDeployNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding $apiPaywallDeployNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallDeployNotFoundError');
        $this->apiPaywallDeployNotFoundErrorJsonEncoding = $apiPaywallDeployNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallDeployNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding
    {
        return $this->apiPaywallDeployNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}