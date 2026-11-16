<?php

namespace Voidhash\Generated\Core\Exception;

class SdkGetPersonBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding
     */
    private $apiSdkValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding $apiSdkValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/SdkValidationError');
        $this->apiSdkValidationErrorJsonEncoding = $apiSdkValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiSdkValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding
    {
        return $this->apiSdkValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}