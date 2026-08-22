<?php

namespace Voidhash\Generated\Core\Exception;

class SdkRegisterDeviceBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding
     */
    private $apiPushDeviceValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding $apiPushDeviceValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PushDeviceValidationError');
        $this->apiPushDeviceValidationErrorJsonEncoding = $apiPushDeviceValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPushDeviceValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding
    {
        return $this->apiPushDeviceValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}