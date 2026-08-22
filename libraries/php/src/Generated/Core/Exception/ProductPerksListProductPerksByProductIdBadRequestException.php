<?php

namespace Voidhash\Generated\Core\Exception;

class ProductPerksListProductPerksByProductIdBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding
     */
    private $apiProductPerkValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding $apiProductPerkValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ProductPerkValidationError');
        $this->apiProductPerkValidationErrorJsonEncoding = $apiProductPerkValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiProductPerkValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiProductPerkValidationErrorJsonEncoding
    {
        return $this->apiProductPerkValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}