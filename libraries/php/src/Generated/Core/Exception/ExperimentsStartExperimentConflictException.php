<?php

namespace Voidhash\Generated\Core\Exception;

class ExperimentsStartExperimentConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiExperimentConflictErrorJsonEncoding
     */
    private $apiExperimentConflictErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiExperimentConflictErrorJsonEncoding $apiExperimentConflictErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ExperimentConflictError');
        $this->apiExperimentConflictErrorJsonEncoding = $apiExperimentConflictErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiExperimentConflictErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiExperimentConflictErrorJsonEncoding
    {
        return $this->apiExperimentConflictErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}