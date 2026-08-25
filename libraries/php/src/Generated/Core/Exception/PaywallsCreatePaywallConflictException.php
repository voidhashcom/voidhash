<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallsCreatePaywallConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPaywallSlugAlreadyExistsErrorJsonEncoding
     */
    private $apiPaywallSlugAlreadyExistsErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPaywallSlugAlreadyExistsErrorJsonEncoding $apiPaywallSlugAlreadyExistsErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PaywallSlugAlreadyExistsError');
        $this->apiPaywallSlugAlreadyExistsErrorJsonEncoding = $apiPaywallSlugAlreadyExistsErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPaywallSlugAlreadyExistsErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPaywallSlugAlreadyExistsErrorJsonEncoding
    {
        return $this->apiPaywallSlugAlreadyExistsErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}