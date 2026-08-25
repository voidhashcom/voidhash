<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallLocationsCreatePaywallLocationConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding
     */
    private $apiPaywallLocationSlugAlreadyExistsErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding $apiPaywallLocationSlugAlreadyExistsErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallLocationSlugAlreadyExistsError');
        $this->apiPaywallLocationSlugAlreadyExistsErrorJsonEncoding = $apiPaywallLocationSlugAlreadyExistsErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding
    {
        return $this->apiPaywallLocationSlugAlreadyExistsErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}