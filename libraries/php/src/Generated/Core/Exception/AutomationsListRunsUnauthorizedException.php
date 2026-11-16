<?php

namespace Voidhash\Generated\Core\Exception;

class AutomationsListRunsUnauthorizedException extends UnauthorizedException
{
    /**
     * @var \Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding
     */
    private $unauthenticatedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding $unauthenticatedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`unauthenticated`: the credential is missing, invalid or expired.');
        $this->unauthenticatedErrorJsonEncoding = $unauthenticatedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getUnauthenticatedErrorJsonEncoding(): \Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding
    {
        return $this->unauthenticatedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}