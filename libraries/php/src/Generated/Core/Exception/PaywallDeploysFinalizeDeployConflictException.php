<?php

namespace Voidhash\Generated\Core\Exception;

class PaywallDeploysFinalizeDeployConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding
     */
    private $apiIncompleteDeployErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding $apiIncompleteDeployErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/IncompleteDeployError');
        $this->apiIncompleteDeployErrorJsonEncoding = $apiIncompleteDeployErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiIncompleteDeployErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding
    {
        return $this->apiIncompleteDeployErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}