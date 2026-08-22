<?php

namespace Voidhash\Generated\Core\Exception;

class ApiKeysGetApiKeyByIdNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding
     */
    private $apiApiKeyNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding $apiApiKeyNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ApiKeyNotFoundError');
        $this->apiApiKeyNotFoundErrorJsonEncoding = $apiApiKeyNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiApiKeyNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiApiKeyNotFoundErrorJsonEncoding
    {
        return $this->apiApiKeyNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}