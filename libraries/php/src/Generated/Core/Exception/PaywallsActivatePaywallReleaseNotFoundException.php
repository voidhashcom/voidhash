<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallsActivatePaywallReleaseNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallReleaseNotFoundErrorJsonEncoding
     */
    private $apiPaywallReleaseNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallReleaseNotFoundErrorJsonEncoding $apiPaywallReleaseNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallReleaseNotFoundError');
        $this->apiPaywallReleaseNotFoundErrorJsonEncoding = $apiPaywallReleaseNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallReleaseNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallReleaseNotFoundErrorJsonEncoding
    {
        return $this->apiPaywallReleaseNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}