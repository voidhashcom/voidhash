<?php

namespace Voidhash\Generated\Core\Exception;

class PersonsGetPersonByDistinctIdInternalServerErrorException extends InternalServerErrorException
{
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(?\Psr\Http\Message\ResponseInterface $response = null)
    {
        parent::__construct('Api/PersonServiceError | Api/AuthenticationError');
        $this->response = $response;
    }
    public function getResponse(): ?\Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}