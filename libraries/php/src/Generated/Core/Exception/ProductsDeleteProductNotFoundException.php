<?php

namespace Voidhash\Generated\Core\Exception;

class ProductsDeleteProductNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiProductNotFoundErrorJsonEncoding
     */
    private $apiProductNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiProductNotFoundErrorJsonEncoding $apiProductNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ProductNotFoundError');
        $this->apiProductNotFoundErrorJsonEncoding = $apiProductNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiProductNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiProductNotFoundErrorJsonEncoding
    {
        return $this->apiProductNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}