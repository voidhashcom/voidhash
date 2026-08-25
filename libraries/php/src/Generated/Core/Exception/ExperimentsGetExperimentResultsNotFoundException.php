<?php

namespace Voidhash\Generated\Core\Exception;

class ExperimentsGetExperimentResultsNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiExperimentNotFoundErrorJsonEncoding
     */
    private $apiExperimentNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiExperimentNotFoundErrorJsonEncoding $apiExperimentNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ExperimentNotFoundError');
        $this->apiExperimentNotFoundErrorJsonEncoding = $apiExperimentNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiExperimentNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiExperimentNotFoundErrorJsonEncoding
    {
        return $this->apiExperimentNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}