<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallDeploysUploadBlobConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding
     */
    private $apiPaywallDeployNotPendingErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding $apiPaywallDeployNotPendingErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallDeployNotPendingError');
        $this->apiPaywallDeployNotPendingErrorJsonEncoding = $apiPaywallDeployNotPendingErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallDeployNotPendingErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding
    {
        return $this->apiPaywallDeployNotPendingErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}