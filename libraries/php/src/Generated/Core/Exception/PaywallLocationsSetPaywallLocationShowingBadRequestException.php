<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallLocationsSetPaywallLocationShowingBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallLocationShowingValidationErrorJsonEncoding
     */
    private $apiPaywallLocationShowingValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallLocationShowingValidationErrorJsonEncoding $apiPaywallLocationShowingValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallLocationShowingValidationError');
        $this->apiPaywallLocationShowingValidationErrorJsonEncoding = $apiPaywallLocationShowingValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallLocationShowingValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallLocationShowingValidationErrorJsonEncoding
    {
        return $this->apiPaywallLocationShowingValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}