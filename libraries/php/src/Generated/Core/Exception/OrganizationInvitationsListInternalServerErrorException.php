<?php

namespace Voidhash\Generated\Core\Exception;

class OrganizationInvitationsListInternalServerErrorException extends InternalServerErrorException
{
    /**
     * @var \Voidhash\Generated\Core\Model\InternalErrorJsonEncoding
     */
    private $internalErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\InternalErrorJsonEncoding $internalErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`internal`: something failed on our side. Retry safe requests with backoff.');
        $this->internalErrorJsonEncoding = $internalErrorJsonEncoding;
        $this->response = $response;
    }
    public function getInternalErrorJsonEncoding(): \Voidhash\Generated\Core\Model\InternalErrorJsonEncoding
    {
        return $this->internalErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}