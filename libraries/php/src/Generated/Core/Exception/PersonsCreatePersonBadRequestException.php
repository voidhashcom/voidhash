<?php

namespace Voidhash\Generated\Core\Exception;

class PersonsCreatePersonBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPersonInvalidAnonymousIdErrorJsonEncoding
     */
    private $apiPersonInvalidAnonymousIdErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPersonInvalidAnonymousIdErrorJsonEncoding $apiPersonInvalidAnonymousIdErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PersonInvalidAnonymousIdError');
        $this->apiPersonInvalidAnonymousIdErrorJsonEncoding = $apiPersonInvalidAnonymousIdErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPersonInvalidAnonymousIdErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPersonInvalidAnonymousIdErrorJsonEncoding
    {
        return $this->apiPersonInvalidAnonymousIdErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}