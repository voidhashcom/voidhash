<?php

namespace Voidhash\Generated\Core\Exception;

class PerksGetPerkNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPerkNotFoundErrorJsonEncoding
     */
    private $apiPerkNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPerkNotFoundErrorJsonEncoding $apiPerkNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PerkNotFoundError');
        $this->apiPerkNotFoundErrorJsonEncoding = $apiPerkNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPerkNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPerkNotFoundErrorJsonEncoding
    {
        return $this->apiPerkNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}