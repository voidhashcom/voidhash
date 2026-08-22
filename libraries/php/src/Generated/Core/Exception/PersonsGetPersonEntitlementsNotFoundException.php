<?php

namespace Voidhash\Generated\Core\Exception;

class PersonsGetPersonEntitlementsNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding
     */
    private $apiPersonNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding $apiPersonNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PersonNotFoundError');
        $this->apiPersonNotFoundErrorJsonEncoding = $apiPersonNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPersonNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding
    {
        return $this->apiPersonNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}