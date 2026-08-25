<?php

namespace Voidhash\Generated\Core\Exception;

class PerksCreatePerkConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPerkSlugAlreadyExistsErrorJsonEncoding
     */
    private $apiPerkSlugAlreadyExistsErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPerkSlugAlreadyExistsErrorJsonEncoding $apiPerkSlugAlreadyExistsErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PerkSlugAlreadyExistsError');
        $this->apiPerkSlugAlreadyExistsErrorJsonEncoding = $apiPerkSlugAlreadyExistsErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPerkSlugAlreadyExistsErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPerkSlugAlreadyExistsErrorJsonEncoding
    {
        return $this->apiPerkSlugAlreadyExistsErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}