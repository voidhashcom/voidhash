<?php

namespace Voidhash\Generated\Core\Exception;

class SdkSyncPersonAttributesNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiSdkPersonNotFoundErrorJsonEncoding
     */
    private $apiSdkPersonNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiSdkPersonNotFoundErrorJsonEncoding $apiSdkPersonNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/SdkPersonNotFoundError');
        $this->apiSdkPersonNotFoundErrorJsonEncoding = $apiSdkPersonNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiSdkPersonNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiSdkPersonNotFoundErrorJsonEncoding
    {
        return $this->apiSdkPersonNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}