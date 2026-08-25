<?php

namespace Voidhash\Generated\Core\Exception;

class ProjectsGetProjectByIdNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiProjectNotFoundErrorJsonEncoding
     */
    private $apiProjectNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiProjectNotFoundErrorJsonEncoding $apiProjectNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ProjectNotFoundError');
        $this->apiProjectNotFoundErrorJsonEncoding = $apiProjectNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiProjectNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiProjectNotFoundErrorJsonEncoding
    {
        return $this->apiProjectNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}