<?php

namespace Voidhash\Generated\Core\Exception;

class SdkSignPromotionalOfferUnprocessableEntityException extends UnprocessableEntityException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiSdkPromotionalOfferUnavailableErrorJsonEncoding
     */
    private $apiSdkPromotionalOfferUnavailableErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiSdkPromotionalOfferUnavailableErrorJsonEncoding $apiSdkPromotionalOfferUnavailableErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/SdkPromotionalOfferUnavailableError');
        $this->apiSdkPromotionalOfferUnavailableErrorJsonEncoding = $apiSdkPromotionalOfferUnavailableErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiSdkPromotionalOfferUnavailableErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiSdkPromotionalOfferUnavailableErrorJsonEncoding
    {
        return $this->apiSdkPromotionalOfferUnavailableErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}