<?php

namespace Voidhash\Generated\Core\Exception;

class OrganizationsUpdateOrganizationNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiOrganizationNotFoundErrorJsonEncoding
     */
    private $apiOrganizationNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiOrganizationNotFoundErrorJsonEncoding $apiOrganizationNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/OrganizationNotFoundError');
        $this->apiOrganizationNotFoundErrorJsonEncoding = $apiOrganizationNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiOrganizationNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiOrganizationNotFoundErrorJsonEncoding
    {
        return $this->apiOrganizationNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}