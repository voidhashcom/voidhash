<?php

namespace Voidhash\Generated\Core\Exception;

class ProductsAttachProductPerkConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiProductPerkAlreadyExistsErrorJsonEncoding
     */
    private $apiProductPerkAlreadyExistsErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiProductPerkAlreadyExistsErrorJsonEncoding $apiProductPerkAlreadyExistsErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ProductPerkAlreadyExistsError');
        $this->apiProductPerkAlreadyExistsErrorJsonEncoding = $apiProductPerkAlreadyExistsErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiProductPerkAlreadyExistsErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiProductPerkAlreadyExistsErrorJsonEncoding
    {
        return $this->apiProductPerkAlreadyExistsErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}