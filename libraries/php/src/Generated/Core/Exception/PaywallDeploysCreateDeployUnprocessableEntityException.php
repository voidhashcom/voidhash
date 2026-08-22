<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallDeploysCreateDeployUnprocessableEntityException extends UnprocessableEntityException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding
     */
    private $apiPaywallDeployValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding $apiPaywallDeployValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallDeployValidationError');
        $this->apiPaywallDeployValidationErrorJsonEncoding = $apiPaywallDeployValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallDeployValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding
    {
        return $this->apiPaywallDeployValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}