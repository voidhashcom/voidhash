<?php

namespace Voidhash\Generated\Core\Exception;

class PerksListPerksUnauthorizedException extends UnauthorizedException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding
     */
    private $apiNotAuthenticatedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding $apiNotAuthenticatedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/NotAuthenticatedError');
        $this->apiNotAuthenticatedErrorJsonEncoding = $apiNotAuthenticatedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiNotAuthenticatedErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding
    {
        return $this->apiNotAuthenticatedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}