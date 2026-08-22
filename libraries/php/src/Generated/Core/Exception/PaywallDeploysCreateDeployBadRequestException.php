<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallDeploysCreateDeployBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding
     */
    private $apiPaywallDeployUpgradeRequiredErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding $apiPaywallDeployUpgradeRequiredErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallDeployUpgradeRequiredError');
        $this->apiPaywallDeployUpgradeRequiredErrorJsonEncoding = $apiPaywallDeployUpgradeRequiredErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallDeployUpgradeRequiredErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding
    {
        return $this->apiPaywallDeployUpgradeRequiredErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}