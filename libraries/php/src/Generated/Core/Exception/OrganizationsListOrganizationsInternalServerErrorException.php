<?php

namespace Voidhash\Generated\Core\Exception;

class OrganizationsListOrganizationsInternalServerErrorException extends InternalServerErrorException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding
     */
    private $apiAuthServiceErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding $apiAuthServiceErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/AuthServiceError');
        $this->apiAuthServiceErrorJsonEncoding = $apiAuthServiceErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiAuthServiceErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding
    {
        return $this->apiAuthServiceErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}