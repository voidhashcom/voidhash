<?php

namespace Voidhash\Generated\Core\Exception;

class ExperimentsUpdateExperimentBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiExperimentValidationErrorJsonEncoding
     */
    private $apiExperimentValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiExperimentValidationErrorJsonEncoding $apiExperimentValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ExperimentValidationError');
        $this->apiExperimentValidationErrorJsonEncoding = $apiExperimentValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiExperimentValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiExperimentValidationErrorJsonEncoding
    {
        return $this->apiExperimentValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}