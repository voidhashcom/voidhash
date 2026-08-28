<?php

namespace Voidhash\Generated\Core\Exception;

class ProductsDeleteProductBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiProductValidationErrorJsonEncoding
     */
    private $apiProductValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiProductValidationErrorJsonEncoding $apiProductValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ProductValidationError');
        $this->apiProductValidationErrorJsonEncoding = $apiProductValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiProductValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiProductValidationErrorJsonEncoding
    {
        return $this->apiProductValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}