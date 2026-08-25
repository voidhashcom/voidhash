<?php

namespace Voidhash\Generated\Core\Exception;

class ProductsCreateProductConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiProductSlugAlreadyExistsErrorJsonEncoding
     */
    private $apiProductSlugAlreadyExistsErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiProductSlugAlreadyExistsErrorJsonEncoding $apiProductSlugAlreadyExistsErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ProductSlugAlreadyExistsError');
        $this->apiProductSlugAlreadyExistsErrorJsonEncoding = $apiProductSlugAlreadyExistsErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiProductSlugAlreadyExistsErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiProductSlugAlreadyExistsErrorJsonEncoding
    {
        return $this->apiProductSlugAlreadyExistsErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}