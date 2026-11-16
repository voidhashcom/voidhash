<?php

namespace Voidhash\Generated\Core\Exception;

class SdkIdentifyPersonConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding
     */
    private $apiSdkPersonAlreadyIdentifiedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding $apiSdkPersonAlreadyIdentifiedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/SdkPersonAlreadyIdentifiedError');
        $this->apiSdkPersonAlreadyIdentifiedErrorJsonEncoding = $apiSdkPersonAlreadyIdentifiedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiSdkPersonAlreadyIdentifiedErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding
    {
        return $this->apiSdkPersonAlreadyIdentifiedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}