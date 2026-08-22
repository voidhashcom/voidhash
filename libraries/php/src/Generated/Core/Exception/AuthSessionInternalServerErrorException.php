<?php

namespace Voidhash\Generated\Core\Exception;

class AuthSessionInternalServerErrorException extends InternalServerErrorException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding
     */
    private $apiAuthenticationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding $apiAuthenticationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/AuthenticationError');
        $this->apiAuthenticationErrorJsonEncoding = $apiAuthenticationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiAuthenticationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding
    {
        return $this->apiAuthenticationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}